import { create } from 'zustand';
import {
  Delivery,
  DeliveryDraft,
  DeliveryStatus,
  DriverWithProfile,
  LatLng,
} from '@/types';
import * as deliveryService from '@/services/delivery.service';

/**
 * UUID v4 léger (sans dépendance). Sert uniquement de clé d'idempotence côté
 * création de course : n'a PAS besoin de force cryptographique, juste d'être
 * unique par brouillon.
 */
function newIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface DeliveryState {
  draft: DeliveryDraft;
  activeDelivery: Delivery | null;
  activeDriver: DriverWithProfile | null;
  driverLocation: LatLng | null;
  deliveries: Delivery[];
  nearbyDrivers: DriverWithProfile[];
  isSearching: boolean;
  isLoading: boolean;

  setDraftField: <K extends keyof DeliveryDraft>(key: K, value: DeliveryDraft[K]) => void;
  resetDraft: () => void;
  createDelivery: (senderId: string) => Promise<Delivery>;
  autoSearchDriver: () => Promise<DriverWithProfile | null>;
  selectDriver: (driver: DriverWithProfile) => void;
  fetchNearbyDrivers: (location: LatLng) => Promise<void>;
  fetchDeliveries: (userId: string, role: 'client' | 'driver', status?: DeliveryStatus) => Promise<void>;
  setActiveDelivery: (delivery: Delivery | null) => void;
  setDriverLocation: (location: LatLng) => void;
  updateStatus: (deliveryId: string, status: DeliveryStatus) => Promise<void>;
  relaunch: () => Promise<boolean>;
  clear: () => void;
}

export const useDeliveryStore = create<DeliveryState>((set, get) => ({
  draft: {},
  activeDelivery: null,
  activeDriver: null,
  driverLocation: null,
  deliveries: [],
  nearbyDrivers: [],
  isSearching: false,
  isLoading: false,

  setDraftField: (key, value) =>
    set((state) => ({ draft: { ...state.draft, [key]: value } })),

  resetDraft: () => set({ draft: {} }),

  createDelivery: async (senderId) => {
    set({ isLoading: true });
    try {
      // Clé d'idempotence STABLE pour ce brouillon : si le 1er POST a réussi
      // côté serveur mais a timeout côté client (réseau BF), le réessai renvoie
      // la MÊME clé -> le serveur retourne la course déjà créée (pas de doublon).
      // Régénérée seulement quand le brouillon est réinitialisé (nouvelle course).
      let key = get().draft.idempotencyKey;
      if (!key) {
        key = newIdempotencyKey();
        set({ draft: { ...get().draft, idempotencyKey: key } });
      }
      const delivery = await deliveryService.createDelivery(get().draft, senderId);
      set({ activeDelivery: delivery, isLoading: false, draft: {} });
      return delivery;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  autoSearchDriver: async () => {
    const { activeDelivery } = get();
    if (!activeDelivery) return null;

    set({ isSearching: true });
    try {
      const driver = await deliveryService.autoSearchDriver(activeDelivery.id);
      if (driver) {
        const updated = await deliveryService.getDeliveryById(activeDelivery.id);
        set({
          activeDriver: driver,
          activeDelivery: updated,
          driverLocation: driver.driverProfile.currentLocation || null,
          isSearching: false,
        });
      } else {
        set({ isSearching: false });
      }
      return driver;
    } catch {
      set({ isSearching: false });
      return null;
    }
  },

  selectDriver: (driver) => set({ activeDriver: driver }),

  fetchNearbyDrivers: async (location) => {
    try {
      const drivers = await deliveryService.searchNearbyDrivers(location);
      set({ nearbyDrivers: drivers });
    } catch {
      // silencieux: la liste reste vide
    }
  },

  fetchDeliveries: async (userId, role, status) => {
    set({ isLoading: true });
    try {
      const deliveries = await deliveryService.getDeliveries(userId, role, status);
      set({ deliveries, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setActiveDelivery: (delivery) => set({ activeDelivery: delivery }),
  setDriverLocation: (location) => set({ driverLocation: location }),

  updateStatus: async (deliveryId, status) => {
    try {
      const updated = await deliveryService.updateDeliveryStatus(deliveryId, status);
      if (updated) {
        set({ activeDelivery: updated });
      }
    } catch {
      // silencieux
    }
  },

  relaunch: async () => {
    const current = get().activeDelivery;
    if (!current) return false;
    try {
      const updated = await deliveryService.relaunchDelivery(current.id);
      if (updated) {
        set({ activeDelivery: updated });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  clear: () =>
    set({
      activeDelivery: null,
      activeDriver: null,
      driverLocation: null,
      isSearching: false,
    }),
}));
