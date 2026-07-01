import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '@/config/api';

// Les tokens d'auth (JWT access + refresh) sont stockés dans le Keychain (iOS) /
// Keystore (Android) chiffré via expo-secure-store, plus dans AsyncStorage en
// clair. ⚠️ SecureStore n'accepte que [A-Za-z0-9._-] comme clé : pas de ':'.
const ACCESS_TOKEN_KEY = 'toole_access_token';
const REFRESH_TOKEN_KEY = 'toole_refresh_token';

// Anciennes clés AsyncStorage (versions < 1.1.0). On les migre une seule fois
// vers SecureStore au premier accès pour ne PAS déconnecter les utilisateurs
// déjà connectés lors de la mise à jour, puis on les efface.
const LEGACY_ACCESS_KEY = 'toole:access_token';
const LEGACY_REFRESH_KEY = 'toole:refresh_token';

// AFTER_FIRST_UNLOCK : le token reste lisible tant que l'appareil a été
// déverrouillé au moins une fois depuis le boot — indispensable pour que le
// suivi GPS en arrière-plan du livreur (socket) puisse s'authentifier même
// écran verrouillé. (WHEN_UNLOCKED, le défaut, casserait le background.)
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function migrateLegacyTokens(): Promise<void> {
  try {
    const [legacyAccess, legacyRefresh] = await Promise.all([
      AsyncStorage.getItem(LEGACY_ACCESS_KEY),
      AsyncStorage.getItem(LEGACY_REFRESH_KEY),
    ]);
    if (!legacyAccess && !legacyRefresh) return;
    if (legacyAccess) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, legacyAccess, SECURE_OPTS);
    }
    if (legacyRefresh) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, legacyRefresh, SECURE_OPTS);
    }
    await AsyncStorage.multiRemove([LEGACY_ACCESS_KEY, LEGACY_REFRESH_KEY]);
    console.log('[tokenStorage] migrated tokens AsyncStorage -> SecureStore');
  } catch (e) {
    console.warn('[tokenStorage] legacy token migration failed', e);
  }
}

// La migration ne tourne qu'une fois par process ; chaque lecture l'attend pour
// éviter un faux "déconnecté" au démarrage (avant que la migration ait fini).
let migrationPromise: Promise<void> | null = null;
function ensureMigrated(): Promise<void> {
  if (!migrationPromise) migrationPromise = migrateLegacyTokens();
  return migrationPromise;
}

export const tokenStorage = {
  async setTokens(accessToken: string, refreshToken: string) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, SECURE_OPTS),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, SECURE_OPTS),
    ]);
  },
  async getAccessToken(): Promise<string | null> {
    await ensureMigrated();
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken(): Promise<string | null> {
    await ensureMigrated();
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      // Purge aussi les anciennes clés en clair (au cas où la migration n'a
      // jamais tourné avant un logout).
      AsyncStorage.multiRemove([LEGACY_ACCESS_KEY, LEGACY_REFRESH_KEY]),
    ]);
  },
};

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 15000, // 15s - réseau lent au BF, mais 30s etait excessif
  headers: { 'Content-Type': 'application/json' },
});

// ---------- Logging + mesure ----------
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  (config as any).__startTime = Date.now();
  return config;
});

api.interceptors.response.use(
  (response) => {
    const start = (response.config as any).__startTime as number | undefined;
    const elapsed = start ? Date.now() - start : 0;
    if (elapsed > 3000) {
      console.log(`[API slow ${elapsed}ms] ${response.config.method?.toUpperCase()} ${response.config.url}`);
    }
    return response;
  },
  (error: AxiosError) => {
    const cfg = error.config as any;
    const start = cfg?.__startTime as number | undefined;
    const elapsed = start ? Date.now() - start : 0;
    const status = error.response?.status ?? 'no-response';
    console.log(
      `[API fail ${elapsed}ms ${status}] ${cfg?.method?.toUpperCase() ?? '?'} ${cfg?.url ?? ''} - ${error.message}`,
    );
    return Promise.reject(error);
  },
);

// ---------- Auth refresh on 401 ----------
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

// Callback invoque quand le refresh token échoué aussi (session invalide)
// -> l'app peut logout + renvoyer sur l'écran de connexion.
// `reason` permet de distinguer une suspension d'admin d'une simple expiration.
export interface AuthExpiredReason {
  /** Code API : 'ACCOUNT_UNAVAILABLE' si suspendu, sinon undefined */
  errorCode?: string;
  /** Message API affichable */
  errorMessage?: string;
}
let onAuthExpiredCb: ((reason?: AuthExpiredReason) => void) | null = null;
export function setAuthExpiredHandler(
  cb: ((reason?: AuthExpiredReason) => void) | null,
) {
  onAuthExpiredCb = cb;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest: any = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        console.log('[API] refreshing access token...');
        const { data } = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          { refreshToken },
          { timeout: 10000 },
        );

        const { accessToken, refreshToken: newRefresh } = data.data;
        await tokenStorage.setTokens(accessToken, newRefresh);
        console.log('[API] token refresh OK');

        refreshQueue.forEach((cb) => cb(accessToken));
        refreshQueue = [];

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError: any) {
        console.warn(
          '[API] token refresh FAILED, user will be logged out',
          refreshError,
        );
        refreshQueue.forEach((cb) => cb(null));
        refreshQueue = [];
        await tokenStorage.clear();
        // Si le serveur a explicite un motif (ex: compte suspendu), on le
        // passe au handler pour qu'il puisse afficher le bon message.
        const errorCode = refreshError?.response?.data?.error?.code as
          | string
          | undefined;
        const errorMessage = refreshError?.response?.data?.error?.message as
          | string
          | undefined;
        if (onAuthExpiredCb) onAuthExpiredCb({ errorCode, errorMessage });
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ---------- Unwrap ----------
export function unwrap<T>(response: { data: { data: T; error?: unknown } }): T {
  return response.data.data;
}

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as any;
    if (payload?.error?.message) return payload.error.message;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Erreur inconnue';
}

/**
 * Wrapper pour les appels non-critiques (fire-and-forget).
 * - Swallow toutes les erreurs (plus d'unhandled promise rejection)
 * - Log discret dans la console
 */
export function safeCall<T>(promise: Promise<T>, label: string): Promise<T | null> {
  return promise.catch((err) => {
    const msg = err?.message ?? String(err);
    console.log(`[safeCall:${label}] swallowed: ${msg}`);
    return null;
  });
}
