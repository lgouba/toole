import { create } from 'zustand';
import { api, tokenStorage, unwrap } from './api';
import { Sentry } from './sentry';

export interface AdminUser {
  id: string;
  email: string | null;
  fullName: string;
  userType: string;
}

interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
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
      return true;
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ??
        'Identifiants incorrects ou compte inactif';
      set({ error: msg });
      return false;
    }
  },

  logout: () => {
    tokenStorage.clear();
    Sentry.setUser(null);
    set({ user: null });
  },
}));
