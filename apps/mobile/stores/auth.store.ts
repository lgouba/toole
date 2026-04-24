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
  sendOtp: (phone: string) => Promise<boolean>;
  verifyOtp: (code: string) => Promise<{ success: boolean; isNewUser: boolean }>;
  register: (payload: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    userType: UserRole;
    email?: string;
    vehicleType?: string;
    vehiclePlate?: string;
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
          const result = await authService.sendOtp(phone);
          set({ phoneNumber: phone, isLoading: false });
          return result.success;
        } catch {
          set({ isLoading: false });
          return false;
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
