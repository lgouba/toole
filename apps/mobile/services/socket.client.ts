import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { SOCKET_URL, API_BASE_URL } from '@/config/api';
import { tokenStorage } from './api.client';

let socket: Socket | null = null;
let isReconnecting = false;

/**
 * Connexion Socket.IO authentifiee.
 * - Lit le token frais depuis AsyncStorage a chaque tentative
 * - Si le token est expire (connect_error "Invalid token"), rafraichit via /auth/refresh
 *   et retente une connexion automatiquement.
 */
export async function connectSocket(): Promise<Socket> {
  const token = await tokenStorage.getAccessToken();
  if (!token) throw new Error('Not authenticated');

  if (socket?.connected) return socket;

  // Cleanup ancien socket (évite les doublons)
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: (cb: (data: { token: string }) => void) => {
      // Callback appele a chaque (re)connexion : on relit le token depuis le storage
      tokenStorage.getAccessToken().then((t) => cb({ token: t || '' }));
    },
    // ⚠️ websocket EN PREMIER mais polling en fallback. En websocket-only,
    // certains reseaux Android (proxies operateurs BF, wifi captifs) bloquent
    // l'upgrade websocket → le socket reste mort silencieusement → le livreur
    // ne reçoit jamais delivery:new_request via socket (juste la push). Avec
    // polling en fallback, Socket.IO se rabat sur du HTTP long-polling et la
    // connexion temps reel fonctionne quand meme.
    transports: ['websocket', 'polling'],
    // Autorise l'upgrade websocket apres connexion polling (best of both)
    upgrade: true,
    reconnection: true,
    // Reconnect agressif : 500ms initial, +500ms par tentative, cap a 3s.
    // Reseau BF tres flaky → on veut etre back online le plus vite possible
    // pour ne pas rater de notifs de course.
    reconnectionDelay: 500,
    reconnectionDelayMax: 3_000,
    randomizationFactor: 0.3,
    reconnectionAttempts: Infinity,
    timeout: 10_000,
  });

  // Gestion intelligente des erreurs d'auth
  socket.on('connect_error', async (err: Error) => {
    const isAuthError =
      err.message?.includes('Invalid token') ||
      err.message?.includes('Authentication') ||
      err.message?.includes('jwt');

    if (!isAuthError || isReconnecting) return;

    isReconnecting = true;
    try {
      const refreshed = await refreshAccessToken();
      if (refreshed && socket) {
        // socket.io-client va rappeler la fonction `auth` au prochain tick,
        // donc on peut juste demander une reconnexion.
        socket.connect();
      }
    } catch {
      // Refresh a échoué - utilisateur déconnecté, laisse l'app gérer
    } finally {
      isReconnecting = false;
    }
  });

  return new Promise((resolve, reject) => {
    const onConnect = () => {
      socket!.off('connect_error', onError);
      resolve(socket!);
    };
    const onError = (err: Error) => {
      const isAuthError =
        err.message?.includes('Invalid token') ||
        err.message?.includes('Authentication') ||
        err.message?.includes('jwt');
      // On n'ecoute que les vraies erreurs definitives lors du premier connect
      if (!isAuthError) {
        socket!.off('connect', onConnect);
        reject(err);
      }
      // Sinon on laisse le handler async ci-dessus rafraichir le token
    };
    socket!.once('connect', onConnect);
    socket!.on('connect_error', onError);
  });
}

/**
 * Rafraichit l'access token via /auth/refresh.
 * Retourne true si succès, false sinon.
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
      refreshToken,
    });
    const { accessToken, refreshToken: newRefresh } = data.data;
    await tokenStorage.setTokens(accessToken, newRefresh);
    return true;
  } catch {
    return false;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
