import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '@/types';
import * as authService from '@/services/auth.service';
import * as userService from '@/services/user.service';
import { disconnectSocket } from '@/services/socket.client';
import { Sentry } from '@/services/sentry';

/**
 * Donnees collectees pendant le flow d'inscription, conservees entre les
 * ecrans Register et OTP. Sur OTP soumis, on les envoie a /auth/register.
 */
export interface PendingRegistration {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  userType: UserRole;
  phone: string; // format 226XXXXXXXX
  email: string;
  vehicleType?: string;
  vehiclePlate?: string;
  referralCode?: string;
  /** URLs serveur des photos KYC deja uploadees (route /uploads/kyc est
   *  publique, pas besoin d'auth). Attachees au profil driver apres
   *  creation du compte via PUT /drivers/me/kyc. */
  cnibPhotoUrl?: string;
  cnibPhotoBackUrl?: string;
  /** Quel identifier a recu l'OTP (phone ou email). */
  otpIdentifier: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  /** Tutoriels post-login deja vus par role. Persistant. */
  roleTutorialSeen: { client: boolean; driver: boolean };
  isLoading: boolean;
  phoneNumber: string;
  lastOtpCode: string;
  /** Donnees register en attente de confirmation OTP. */
  pendingRegistration: PendingRegistration | null;
  setPendingRegistration: (data: PendingRegistration | null) => void;

  /** `phoneNumber` est en fait un identifier : peut etre un phone (digits)
   *  ou un email. Le nom historique est garde pour eviter de tout casser. */
  setPhoneNumber: (identifier: string) => void;
  sendOtp: (
    identifier: string,
    channel?: 'sms' | 'whatsapp' | 'email',
  ) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (
    code: string,
  ) => Promise<{
    success: boolean;
    isNewUser: boolean;
    errorCode?: string;
    errorMessage?: string;
  }>;
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
    /** Si true, on cree le compte + stocke les tokens, mais on NE set PAS
     *  isAuthenticated=true. Utilise par le flow KYC driver qui doit pouvoir
     *  uploader des photos avec le token tout en restant sur la page register
     *  (sinon l'auth guard du _layout redirige vers /(driver) instantanement). */
    deferAuth?: boolean;
  }) => Promise<{
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
    /** Detail des erreurs Zod par champ (si VALIDATION_ERROR). */
    fieldErrors?: Record<string, string[]>;
  }>;
  completeOnboarding: () => void;
  /** Marque le tutoriel post-login comme vu pour un role donne. */
  completeRoleTutorial: (role: 'client' | 'driver') => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isOnboarded: false,
      roleTutorialSeen: { client: false, driver: false },
      isLoading: false,
      phoneNumber: '',
      lastOtpCode: '',
      pendingRegistration: null,

      setPhoneNumber: (phone) => set({ phoneNumber: phone }),
      setPendingRegistration: (data) => set({ pendingRegistration: data }),

      sendOtp: async (phone, channel = 'sms') => {
        set({ isLoading: true });
        try {
          console.log('[auth] sendOtp ->', channel, 'for', phone);
          const result = await authService.sendOtp(phone, channel);
          console.log('[auth] sendOtp result:', result);
          set({ phoneNumber: phone, isLoading: false });
          return { success: result.success };
        } catch (err: any) {
          // ⚠️ Infos techniques logguees UNIQUEMENT en console (devs) —
          // jamais affichees a l'utilisateur ni a un eventuel attaquant.
          // (URL backend, codes axios, headers, etc. doivent rester internes)
          const baseURL = err?.config?.baseURL ?? 'unknown';
          const status = err?.response?.status;
          const code = err?.code;
          const apiMsg = err?.response?.data?.error?.message;
          console.warn(
            '[auth] sendOtp FAILED:',
            code,
            err?.message,
            status,
            apiMsg,
            'baseURL:',
            baseURL,
          );
          set({ isLoading: false });

          // Message utilisateur : generique et sans aucune info technique.
          let userMsg: string;
          if (apiMsg && status && status >= 400 && status < 500) {
            // 4xx : c'est une erreur business (ex: numero invalide, quota OTP atteint).
            // Ces messages viennent de notre propre serveur, deja en francais propre.
            userMsg = apiMsg;
          } else if (
            code === 'ECONNABORTED' ||
            /timeout/i.test(err?.message ?? '')
          ) {
            userMsg =
              "Le serveur met trop de temps à répondre. Vérifiez votre connexion et réessayez.";
          } else if (code === 'ERR_NETWORK' || !status) {
            userMsg =
              'Pas de connexion Internet. Activez les données mobiles ou le Wi-Fi puis réessayez.';
          } else {
            userMsg = 'Une erreur est survenue. Veuillez réessayer dans un instant.';
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
          return {
            success: result.success,
            isNewUser: result.isNewUser,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          };
        } catch {
          set({ isLoading: false });
          return { success: false, isNewUser: false };
        }
      },

      register: async (payload) => {
        set({ isLoading: true });
        try {
          const { deferAuth, ...rest } = payload;
          const user = await authService.registerUser({
            phone: get().phoneNumber,
            otpCode: get().lastOtpCode,
            ...rest,
          });
          set({
            user,
            isAuthenticated: deferAuth ? false : true,
            isLoading: false,
            lastOtpCode: '',
          });
          return { success: true } as const;
        } catch (err: any) {
          set({ isLoading: false });
          const errorCode = err?.response?.data?.error?.code as string | undefined;
          const errorMessage = err?.response?.data?.error?.message as string | undefined;
          // En cas de VALIDATION_ERROR, le serveur (Zod) renvoie le detail
          // des champs invalides. On l'exploite pour afficher quel champ exact
          // ne passe pas (au lieu du message generique "validation failed").
          const fieldErrors =
            (err?.response?.data?.error?.details?.fieldErrors as
              | Record<string, string[]>
              | undefined) ?? undefined;
          console.warn(
            '[auth] register failed',
            errorCode,
            errorMessage,
            fieldErrors,
          );
          return {
            success: false,
            errorCode,
            errorMessage,
            fieldErrors,
          } as const;
        }
      },

      completeOnboarding: () => set({ isOnboarded: true }),

      completeRoleTutorial: (role) =>
        set((s) => ({
          roleTutorialSeen: { ...s.roleTutorialSeen, [role]: true },
        })),

      refreshUser: async () => {
        try {
          const fresh = await userService.getMe();
          set({ user: fresh });
          // Identifie l'user pour Sentry : permet de filtrer les crashs par user.
          // On n'envoie PAS le tel ou l'email (PII), juste l'ID + le role.
          Sentry.setUser({
            id: fresh.id,
            username: fresh.userType,
          });
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
        // Reset l'user Sentry au logout (les crashs suivants ne seront pas
        // attribues a l'ancien user).
        Sentry.setUser(null);
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
        roleTutorialSeen: state.roleTutorialSeen,
      }),
    }
  )
);
