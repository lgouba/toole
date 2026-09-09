import { create } from 'zustand';
import { api, tokenStorage, unwrap } from './api';
import { Sentry } from './sentry';

export interface AdminUser {
  id: string;
  email: string | null;
  fullName: string;
  userType: string;
}

/**
 * Résultat de login exposé à l'UI. On remonte le `status` HTTP (et un
 * éventuel `retryAfterSec` pour le 429) pour que la page de connexion mappe
 * elle-même les messages exacts, sans que le store impose un libellé.
 */
export interface LoginResult {
  ok: boolean;
  status?: number;
  retryAfterSec?: number;
}

interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  init: async () => {
    const token = tokenStorage.get();
    if (!token) {
      set({ loading: false, user: null });
      return;
    }
    try {
      const res = await api.get('/admin/me');
      const u = unwrap<AdminUser>(res);
      set({ user: u, loading: false });
      // Identifie le user admin pour Sentry (id + role uniquement, pas l'email)
      Sentry.setUser({ id: u.id, username: u.userType });
    } catch {
      tokenStorage.clear();
      set({ loading: false, user: null });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    try {
      const res = await api.post('/admin/login', { email, password });
      const data = unwrap<{ user: AdminUser; accessToken: string }>(res);
      tokenStorage.set(data.accessToken);
      set({ user: data.user });
      Sentry.setUser({ id: data.user.id, username: data.user.userType });
      return { ok: true };
    } catch (err: any) {
      const status: number | undefined = err?.response?.status;
      // `Retry-After` en secondes si le serveur l'expose (limiter 429).
      const ra = Number(err?.response?.headers?.['retry-after']);
      const retryAfterSec = Number.isFinite(ra) && ra > 0 ? ra : undefined;
      return { ok: false, status, retryAfterSec };
    }
  },

  logout: () => {
    tokenStorage.clear();
    Sentry.setUser(null);
    set({ user: null });
  },
}));
