import { create } from 'zustand';
import { api, tokenStorage, unwrap } from './api';

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
      set({ user: unwrap<AdminUser>(res), loading: false });
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
    set({ user: null });
  },
}));
