import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, unwrap } from '@/services/api.client';

export interface PricingSettings {
  basePriceEnvelope: number;
  basePriceSmall: number;
  basePriceLarge: number;
  pricePerKm: number;
  platformCommissionPct: number;
}

export interface OperationSettings {
  /** Durée de recherche d'un livreur avant expiration côté client (en minutes) */
  deliveryExpiryMinutes: number;
  /** Délai avant que le livreur puisse annuler après acceptation (en secondes) */
  driverCancelCooldownSeconds: number;
  /** Rayon de diffusion aux livreurs (km) — informatif pour le mobile */
  nearbyRadiusKm: number;
  /** Délai minimum entre maintenant et l'heure choisie pour qu'une livraison
   *  soit acceptée comme programmée (en minutes). En dessous, immediate. */
  scheduledMinDelayMinutes: number;
}

export interface PublicSettings {
  appName: string;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  currencyLocale: string;
  confettiEnabled: boolean;
  driverSoundEnabled: boolean;
  driverVibrationEnabled: boolean;
  pricing: PricingSettings;
  operations: OperationSettings;
}

const DEFAULT_SETTINGS: PublicSettings = {
  appName: 'Tolle',
  primaryColor: '#1d9e75',
  secondaryColor: '#d85a30',
  currency: 'FCFA',
  currencyLocale: 'fr-BF',
  confettiEnabled: true,
  driverSoundEnabled: true,
  driverVibrationEnabled: true,
  pricing: {
    basePriceEnvelope: 500,
    basePriceSmall: 800,
    basePriceLarge: 1200,
    pricePerKm: 100,
    platformCommissionPct: 15,
  },
  operations: {
    deliveryExpiryMinutes: 5,
    driverCancelCooldownSeconds: 120,
    nearbyRadiusKm: 5,
    scheduledMinDelayMinutes: 10,
  },
};

interface SettingsState {
  settings: PublicSettings;
  loaded: boolean;
  refresh: () => Promise<void>;
}

/**
 * Paramètres globaux de la plateforme (monnaie, couleurs, toggles).
 * Fetchés depuis /api/settings au démarrage, persisté en AsyncStorage pour
 * être dispo offline et au 1er render.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      loaded: false,

      refresh: async () => {
        try {
          const res = await api.get('/settings');
          const data = unwrap<PublicSettings>(res);
          set({ settings: { ...DEFAULT_SETTINGS, ...data }, loaded: true });
        } catch {
          // On garde les valeurs en cache / defaut
          set({ loaded: true });
        }
      },
    }),
    {
      name: 'tolle-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);

/** Formatte un montant avec la devise configurée. */
export function formatCurrency(amount: number): string {
  const { settings } = useSettingsStore.getState();
  try {
    return new Intl.NumberFormat(settings.currencyLocale, {
      maximumFractionDigits: 0,
    }).format(amount) + ' ' + settings.currency;
  } catch {
    return `${amount} ${settings.currency}`;
  }
}
