import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Préférences de notifications de l'utilisateur, persistées localement.
 *
 * - `master` : interrupteur global. Quand il est OFF, on désenregistre le push
 *   token côté backend (plus aucune notif). Quand il est ON, on (re)enregistre.
 *   C'est la seule préférence pleinement effective en OTA aujourd'hui.
 * - Les 3 catégories sont stockées ici dès maintenant (UI), mais leur filtrage
 *   réel se fait côté serveur à l'envoi — livré avec le prochain rebuild API
 *   (lot API : filtrage par catégorie + canal OTP). Tant que ce n'est pas
 *   déployé, elles n'ont pas d'effet sur ce qui est envoyé.
 */
export interface NotificationPrefs {
  master: boolean;
  newDeliveries: boolean;
  deliveryUpdates: boolean;
  promotions: boolean;
}

interface NotificationPrefsState extends NotificationPrefs {
  setMaster: (on: boolean) => void;
  setCategory: (key: 'newDeliveries' | 'deliveryUpdates' | 'promotions', on: boolean) => void;
}

export const useNotificationPrefsStore = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      master: true,
      newDeliveries: true,
      deliveryUpdates: true,
      promotions: true,
      setMaster: (on) => set({ master: on }),
      setCategory: (key, on) => set({ [key]: on } as Partial<NotificationPrefsState>),
    }),
    {
      name: 'toole-notification-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
