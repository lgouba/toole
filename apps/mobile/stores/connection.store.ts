import { create } from 'zustand';

/**
 * Etat de la connexion socket temps reel.
 *
 * Mis a jour par SocketProvider sur les evenements connect/disconnect/reconnect.
 * Lu par <ConnectionBanner /> pour afficher un bandeau quand l'app perd la
 * connexion en temps reel (l'app marche toujours via polling HTTP, mais
 * l'utilisateur doit savoir que les notifs et le live tracking sont degrades).
 */
interface ConnectionState {
  /** True si le socket.io est actuellement connecte au serveur. */
  isConnected: boolean;
  /** Timestamp (ms) de la derniere deconnexion. Utile pour ne pas afficher
   *  le banner avant un certain delai (eviter les flashs sur reseaux instables). */
  lastDisconnectAt: number | null;
  /** Nombre de deconnexions depuis le lancement de l'app (debug/telemetrie). */
  disconnectCount: number;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isConnected: true,
  lastDisconnectAt: null,
  disconnectCount: 0,
  setConnected: (connected) =>
    set((state) => {
      if (connected) {
        return { isConnected: true };
      }
      return {
        isConnected: false,
        lastDisconnectAt: Date.now(),
        disconnectCount: state.disconnectCount + 1,
      };
    }),
  reset: () =>
    set({ isConnected: true, lastDisconnectAt: null, disconnectCount: 0 }),
}));
