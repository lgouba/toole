import { create } from 'zustand';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { Delivery, LatLng } from '@/types';
import * as deliveryService from '@/services/delivery.service';
import * as driverService from '@/services/driver.service';
import { getSocket } from '@/services/socket.client';

const LOCATION_INTERVAL_MS = 10_000; // 10s
let locationInterval: ReturnType<typeof setInterval> | null = null;

interface DriverState {
  isOnline: boolean;
  todayDeliveries: number;
  todayEarnings: number;
  currentRequest: Delivery | null;
  activeDelivery: Delivery | null;
  currentLocation: LatLng | null;

  toggleOnline: () => Promise<void>;
  receiveRequest: (delivery: Delivery) => void;
  acceptRequest: () => Promise<void>;
  rejectRequest: () => void;
  setActiveDelivery: (delivery: Delivery | null) => void;
  confirmPickup: (photoUri: string, pickupCode: string) => Promise<void>;
  validateCode: (code: string) => Promise<boolean>;
  confirmDelivery: (photoUri: string) => Promise<void>;
  cancelActiveDelivery: (reason: string, comment?: string) => Promise<boolean>;
  clearActiveDelivery: () => void;
  incrementTodayStats: (commission: number) => void;
}

async function pushLocation(): Promise<LatLng | null> {
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });
    const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    await driverService.updateLocation(loc);

    // Emit via socket si on a une course active (pour que le client voit le livreur bouger)
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('driver:update_location', loc);
    }
    return loc;
  } catch {
    return null;
  }
}

function startLocationTracking(setLoc: (loc: LatLng) => void) {
  if (locationInterval) clearInterval(locationInterval);
  // Push immediatement puis toutes les 10s
  pushLocation().then((loc) => {
    if (loc) setLoc(loc);
  });
  locationInterval = setInterval(() => {
    pushLocation().then((loc) => {
      if (loc) setLoc(loc);
    });
  }, LOCATION_INTERVAL_MS);
}

function stopLocationTracking() {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
}

export const useDriverStore = create<DriverState>((set, get) => ({
  isOnline: false,
  todayDeliveries: 0,
  todayEarnings: 0,
  currentRequest: null,
  activeDelivery: null,
  currentLocation: null,

  toggleOnline: async () => {
    const next = !get().isOnline;

    if (next) {
      // Passer EN LIGNE: demander permission GPS + pousser la position
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'Activez la localisation pour recevoir des demandes de course.',
        );
        return;
      }

      try {
        await driverService.setOnlineStatus(true);
        set({ isOnline: true });
        startLocationTracking((loc) => set({ currentLocation: loc }));
      } catch {
        Alert.alert('Erreur', 'Impossible de passer en ligne. Réessayez.');
      }
    } else {
      // Passer HORS LIGNE: stopper le tracking
      stopLocationTracking();
      try {
        await driverService.setOnlineStatus(false);
      } catch {
        // ok on passe quand même offline côté UI
      }
      // On garde la derniere currentLocation connue pour centrer la carte
      // même quand le livreur est hors ligne (récupération GPS hors-line
      // via expo-location au besoin).
      set({ isOnline: false });
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

  confirmPickup: async (photoUri, pickupCode) => {
    const { activeDelivery } = get();
    if (!activeDelivery) throw new Error('Pas de course active');

    const updated = await deliveryService.confirmPickup(
      activeDelivery.id,
      photoUri,
      pickupCode,
    );
    if (!updated) throw new Error('Échec de la confirmation de récupération');
    set({ activeDelivery: updated });
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

  cancelActiveDelivery: async (reason, comment) => {
    const { activeDelivery } = get();
    if (!activeDelivery) return false;
    try {
      const updated = await deliveryService.cancelDelivery(
        activeDelivery.id,
        reason,
        comment,
      );
      // updated peut revenir avec status 'pending' (remise en file) ou 'cancelled'
      if (updated) {
        set({ activeDelivery: null, currentRequest: null });
        return true;
      }
    } catch (err: any) {
      // Backend peut renvoyer 429 avec un message (cooldown non écoulé)
      const msg =
        err?.response?.data?.error?.message ??
        'Impossible d\'annuler la course. Réessayez.';
      Alert.alert('Annulation impossible', msg);
      return false;
    }
    return false;
  },

  clearActiveDelivery: () => set({ activeDelivery: null, currentRequest: null }),

  incrementTodayStats: (commission) =>
    set((state) => ({
      todayDeliveries: state.todayDeliveries + 1,
      todayEarnings: state.todayEarnings + commission,
    })),
}));
