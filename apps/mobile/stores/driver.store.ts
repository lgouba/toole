import { create } from 'zustand';
import { Delivery } from '@/types';
import * as deliveryService from '@/services/delivery.service';
import * as driverService from '@/services/driver.service';

interface DriverState {
  isOnline: boolean;
  todayDeliveries: number;
  todayEarnings: number;
  currentRequest: Delivery | null;
  activeDelivery: Delivery | null;

  toggleOnline: () => Promise<void>;
  receiveRequest: (delivery: Delivery) => void;
  acceptRequest: () => Promise<void>;
  rejectRequest: () => void;
  setActiveDelivery: (delivery: Delivery | null) => void;
  confirmPickup: (photoUri: string) => Promise<void>;
  validateCode: (code: string) => Promise<boolean>;
  confirmDelivery: (photoUri: string) => Promise<void>;
  clearActiveDelivery: () => void;
  incrementTodayStats: (commission: number) => void;
}

export const useDriverStore = create<DriverState>((set, get) => ({
  isOnline: false,
  todayDeliveries: 0,
  todayEarnings: 0,
  currentRequest: null,
  activeDelivery: null,

  toggleOnline: async () => {
    const next = !get().isOnline;
    try {
      await driverService.setOnlineStatus(next);
      set({ isOnline: next });
    } catch {
      // Rollback - stay with current
    }
  },

  receiveRequest: (delivery) => set({ currentRequest: delivery }),

  acceptRequest: async () => {
    const { currentRequest } = get();
    if (!currentRequest) return;

    const updated = await deliveryService.updateDeliveryStatus(currentRequest.id, 'accepted');
    if (updated) {
      set({ activeDelivery: updated, currentRequest: null });
    }
  },

  rejectRequest: () => set({ currentRequest: null }),

  setActiveDelivery: (delivery) => set({ activeDelivery: delivery }),

  confirmPickup: async (photoUri) => {
    const { activeDelivery } = get();
    if (!activeDelivery) return;

    const updated = await deliveryService.confirmPickup(activeDelivery.id, photoUri);
    if (updated) set({ activeDelivery: updated });
  },

  validateCode: async (code) => {
    const { activeDelivery } = get();
    if (!activeDelivery) return false;

    const result = await deliveryService.validateDeliveryCode(activeDelivery.id, code);
    if (result.success && result.delivery) {
      set((state) => ({
        activeDelivery: result.delivery!,
        todayDeliveries: state.todayDeliveries + 1,
        todayEarnings: state.todayEarnings + (result.delivery!.driverCommission || 0),
      }));
    }
    return result.success;
  },

  confirmDelivery: async (_photoUri) => {
    set({ activeDelivery: null });
  },

  clearActiveDelivery: () => set({ activeDelivery: null, currentRequest: null }),

  incrementTodayStats: (commission) =>
    set((state) => ({
      todayDeliveries: state.todayDeliveries + 1,
      todayEarnings: state.todayEarnings + commission,
    })),
}));
