import { create } from 'zustand';
import * as Location from 'expo-location';
import { LatLng } from '@/types';
import { OUAGADOUGOU_CENTER } from '@/utils/geo';

/**
 * Position GPS courante de l'utilisateur (client ou livreur).
 * Recuperee une fois au demarrage de l'app puis rafraichie a la demande.
 *
 * Utilisee pour :
 *  - Centre par defaut de la carte (au lieu de OUAGADOUGOU_CENTER hardcode)
 *  - Bias des recherches Nominatim (priorise les adresses proches)
 *  - Recherche des livreurs proches (cote client)
 *
 * Si la permission est refusee ou que le GPS n'est pas dispo, on retombe
 * sur OUAGADOUGOU_CENTER comme fallback raisonnable (l'app est BF-first
 * mais fonctionne partout).
 */
interface LocationState {
  current: LatLng | null;
  permissionGranted: boolean;
  isLoading: boolean;
  /** Refresh la position. Demande la permission si pas encore accordee. */
  refresh: () => Promise<LatLng | null>;
  /** Position avec fallback sur Ouagadougou si pas de GPS. */
  getCenterOrFallback: () => LatLng;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  current: null,
  permissionGranted: false,
  isLoading: false,

  refresh: async () => {
    set({ isLoading: true });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ permissionGranted: false, isLoading: false });
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const loc: LatLng = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      set({ current: loc, permissionGranted: true, isLoading: false });
      return loc;
    } catch (err) {
      console.warn('[location.store] refresh failed', err);
      set({ isLoading: false });
      return null;
    }
  },

  getCenterOrFallback: () => {
    return get().current ?? OUAGADOUGOU_CENTER;
  },
}));
