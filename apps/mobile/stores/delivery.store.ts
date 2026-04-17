import { create } from 'zustand';
import {
  Delivery,
  DeliveryDraft,
  DeliveryStatus,
  DriverWithProfile,
  LatLng,
} from '@/types';
import * as deliveryService from '@/services/delivery.service';

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
    const delivery = await deliveryService.createDelivery(get().draft, senderId);
    set({ activeDelivery: delivery, isLoading: false, draft: {} });
    return delivery;
  },

  autoSearchDriver: async () => {
    const { activeDelivery } = get();
    if (!activeDelivery) return null;

    set({ isSearching: true });
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
  },

  selectDriver: (driver) => set({ activeDriver: driver }),

  fetchNearbyDrivers: async (location) => {
    const drivers = await deliveryService.searchNearbyDrivers(location);
    set({ nearbyDrivers: drivers });
  },

  fetchDeliveries: async (userId, role, status) => {
    set({ isLoading: true });
    const deliveries = await deliveryService.getDeliveries(userId, role, status);
    set({ deliveries, isLoading: false });
  },

  setActiveDelivery: (delivery) => set({ activeDelivery: delivery }),
  setDriverLocation: (location) => set({ driverLocation: location }),

  updateStatus: async (deliveryId, status) => {
    const updated = await deliveryService.updateDeliveryStatus(deliveryId, status);
    if (updated) {
      set({ activeDelivery: updated });
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
