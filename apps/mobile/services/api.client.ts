import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/config/api';

const ACCESS_TOKEN_KEY = 'toole:access_token';
const REFRESH_TOKEN_KEY = 'toole:refresh_token';

export const tokenStorage = {
  async setTokens(accessToken: string, refreshToken: string) {
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, accessToken],
      [REFRESH_TOKEN_KEY, refreshToken],
    ]);
  },
  async getAccessToken(): Promise<string | null> {
    return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  },
  async clear() {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
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
