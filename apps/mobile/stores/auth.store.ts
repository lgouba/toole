import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '@/types';
import * as authService from '@/services/auth.service';
import * as userService from '@/services/user.service';
import { disconnectSocket } from '@/services/socket.client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isLoading: boolean;
  phoneNumber: string;
  lastOtpCode: string;

  setPhoneNumber: (phone: string) => void;
  sendOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (code: string) => Promise<{ success: boolean; isNewUser: boolean }>;
  register: (payload: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    userType: UserRole;
    email?: string;
    vehicleType?: string;
    vehiclePlate?: string;
    /** Code de parrainage saisi (optionnel, stockage only pour l'instant). */
    referralCode?: string;
  }) => Promise<boolean>;
  completeOnboarding: () => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isOnboarded: false,
      isLoading: false,
      phoneNumber: '',
      lastOtpCode: '',

      setPhoneNumber: (phone) => set({ phoneNumber: phone }),

      sendOtp: async (phone) => {
        set({ isLoading: true });
        try {
          console.log('[auth] sendOtp -> calling backend with phone', phone);
          const result = await authService.sendOtp(phone);
          console.log('[auth] sendOtp result:', result);
          set({ phoneNumber: phone, isLoading: false });
          return { success: result.success };
        } catch (err: any) {
          const baseURL = err?.config?.baseURL ?? 'unknown';
          const status = err?.response?.status;
          const code = err?.code;
          const apiMsg = err?.response?.data?.error?.message;
          console.warn('[auth] sendOtp FAILED:', code, err?.message, status, apiMsg, 'baseURL:', baseURL);
          set({ isLoading: false });
          // Compose un message lisible pour le UI
          let userMsg = '';
          if (apiMsg) {
            userMsg = apiMsg;
          } else if (code === 'ECONNABORTED' || /timeout/i.test(err?.message ?? '')) {
            userMsg = `Timeout. URL: ${baseURL}`;
          } else if (code === 'ERR_NETWORK' || !status) {
            userMsg = `Pas de reseau. URL: ${baseURL}`;
          } else {
            userMsg = `${status ?? '?'} ${err?.message ?? 'erreur'}`;
          }
          return { success: false, error: userMsg };
        }
      },

      verifyOtp: async (code) => {
        set({ isLoading: true, lastOtpCode: code });
        try {
          const result = await authService.verifyOtp(get().phoneNumber, code);
          if (result.success && result.user) {
            set({ user: result.user, isAuthenticated: true, isLoading: false });
          } else {
            set({ isLoading: false });
          }
          return { success: result.success, isNewUser: result.isNewUser };
        } catch {
          set({ isLoading: false });
          return { success: false, isNewUser: false };
        }
      },

      register: async (payload) => {
        set({ isLoading: true });
        try {
          const user = await authService.registerUser({
            phone: get().phoneNumber,
            otpCode: get().lastOtpCode,
            ...payload,
          });
          set({ user, isAuthenticated: true, isLoading: false, lastOtpCode: '' });
          return true;
        } catch {
          set({ isLoading: false });
          return false;
        }
      },

      completeOnboarding: () => set({ isOnboarded: true }),

      refreshUser: async () => {
        try {
          const fresh = await userService.getMe();
          set({ user: fresh });
        } catch (err: any) {
          // Si 401 (token invalide) -> logout propre.
          // Sinon (timeout, réseau, 5xx...) on ne fait rien, le user en cache reste utilisable.
          if (err?.response?.status === 401) {
            try {
              disconnectSocket();
              await authService.logout();
            } catch {
              /* ignore */
            }
            set({
              user: null,
              isAuthenticated: false,
              phoneNumber: '',
              lastOtpCode: '',
            });
          }
        }
      },

      logout: async () => {
        disconnectSocket();
        await authService.logout();
        set({
          user: null,
          isAuthenticated: false,
          phoneNumber: '',
          lastOtpCode: '',
        });
      },
    }),
    {
      name: 'tolle-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isOnboarded: state.isOnboarded,
      }),
    }
  )
);
