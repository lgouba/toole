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
  /** Course "chainee" recue alors que le livreur a une course active.
   *  Stockee en attendant la fin de la course actuelle pour etre promue
   *  en currentRequest (et afficher la modal pleine). */
  queuedNextRequest: Delivery | null;
  activeDelivery: Delivery | null;
  currentLocation: LatLng | null;

  toggleOnline: () => Promise<void>;
  receiveRequest: (delivery: Delivery) => void;
  /** Nouvelle demande recue alors qu'une course est active mais bientot finie
   *  (chainage active cote serveur). Affichee en banniere non-bloquante. */
  receiveChainedRequest: (delivery: Delivery) => void;
  /** Promeut la queuedNextRequest en currentRequest (modal pleine).
   *  Appele automatiquement quand activeDelivery devient null. */
  promoteQueuedRequest: () => void;
  /** Annule la queuedNextRequest (l'utilisateur a refuse la banniere). */
  dismissQueuedRequest: () => void;
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
  queuedNextRequest: null,
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
        // ⚠️ ORDRE CRITIQUE : pousser la position GPS AVANT de marquer en
        // ligne. Sinon le serveur marque isOnline=true avec un currentLat
        // null/perime, et tout client qui cree une course dans les ~10s
        // suivantes ne nous trouve PAS via findNearbyDrivers (filtre sur
        // lastLocationUpdate < 2 min). Le bug "il faut toggle off/on pour
        // recevoir les notifs" venait de la.
        //
        // ⚡ PERF : on a longtemps fait getCurrentPositionAsync({BestForNavigation})
        // ici, ce qui pouvait bloquer 5-15s sur un GPS froid → bouton "passer
        // en ligne" lent. Strategie multi-paliers maintenant :
        //   1) getLastKnownPositionAsync() : instant (cache OS), souvent OK
        //      si l'app vient d'utiliser le GPS recemment.
        //   2) sinon getCurrentPositionAsync({Balanced}, timeout 4s) : fix
        //      rapide a ~50m de precision, largement suffisant pour le
        //      filtre findNearbyDrivers (radius par defaut ~5km).
        //   3) Le tracking heartbeat (startLocationTracking) continuera en
        //      BestForNavigation → la precision sera affinee en arriere-plan
        //      des le 1er tick (10s plus tard).
        let initialLoc: LatLng | null = null;
        try {
          // Palier 1 : derniere position connue (instant).
          const last = await Location.getLastKnownPositionAsync({
            maxAge: 60_000, // accepte une position cache de moins d'1 min
            requiredAccuracy: 200, // 200m suffit pour findNearbyDrivers
          });
          if (last) {
            initialLoc = {
              latitude: last.coords.latitude,
              longitude: last.coords.longitude,
            };
          } else {
            // Palier 2 : fix rapide ~1s.
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            initialLoc = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
          }
          await driverService.updateLocation(initialLoc);
        } catch (err) {
          console.warn('[driver] initial GPS push failed', err);
          // Pas bloquant : on continue mais on previent que la position n'a
          // pas encore ete envoyee (notifs immediates risquent de manquer
          // jusqu'au prochain heartbeat ~10s).
        }

        // Maintenant que la position est fraiche cote serveur, on peut
        // passer en ligne. Le notifyPendingDeliveriesToDriver cote serveur
        // trouvera notre position et nous enverra les courses pending.
        await driverService.setOnlineStatus(true);
        set({
          isOnline: true,
          ...(initialLoc ? { currentLocation: initialLoc } : {}),
        });

        // Lance le heartbeat regulier en haute precision (push position
        // toutes les 10s). Affinera la position fournie en palier 1/2.
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

  receiveChainedRequest: (delivery) => {
    // Si pas de course active, fallback en demande standard (modal pleine).
    const { activeDelivery } = get();
    if (!activeDelivery) {
      set({ currentRequest: delivery });
      return;
    }
    // Ne pas ecraser une queued existante (premier arrive, premier servi).
    if (get().queuedNextRequest) return;
    set({ queuedNextRequest: delivery });
  },

  promoteQueuedRequest: () => {
    const { queuedNextRequest } = get();
    if (!queuedNextRequest) return;
    set({ currentRequest: queuedNextRequest, queuedNextRequest: null });
  },

  dismissQueuedRequest: () => set({ queuedNextRequest: null }),

  acceptRequest: async () => {
    const { currentRequest } = get();
    if (!currentRequest) return;

    const updated = await deliveryService.updateDeliveryStatus(currentRequest.id, 'accepted');
    if (updated) {
      set({ activeDelivery: updated, currentRequest: null });
    }
  },

  rejectRequest: () => set({ currentRequest: null }),

  setActiveDelivery: (delivery) => {
    set({ activeDelivery: delivery });
    // Quand la course active se termine et qu'on a une course chainee en file,
    // la promouvoir automatiquement en modal pleine.
    if (delivery === null) {
      const { queuedNextRequest } = get();
      if (queuedNextRequest) {
        set({ currentRequest: queuedNextRequest, queuedNextRequest: null });
      }
    }
  },

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
    // Promouvoir auto la course chainee si presente.
    const { queuedNextRequest } = get();
    if (queuedNextRequest) {
      set({ currentRequest: queuedNextRequest, queuedNextRequest: null });
    }
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

  clearActiveDelivery: () => {
    set({ activeDelivery: null, currentRequest: null });
    const { queuedNextRequest } = get();
    if (queuedNextRequest) {
      set({ currentRequest: queuedNextRequest, queuedNextRequest: null });
    }
  },

  incrementTodayStats: (commission) =>
    set((state) => ({
      todayDeliveries: state.todayDeliveries + 1,
      todayEarnings: state.todayEarnings + commission,
    })),
}));
