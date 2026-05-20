import { create } from 'zustand';
import * as Location from 'expo-location';
import { LatLng } from '@/types';
import { OUAGADOUGOU_CENTER } from '@/utils/geo';

/**
 * Reverse geocode : recupere le code pays ISO 2 + le nom de la ville
 * via expo-location (natif Apple/Google), puis la bounding box de la ville
 * via Nominatim. La bbox permet de restreindre STRICTEMENT l'autocomplete
 * aux adresses de la ville (sinon Nominatim renvoie les chaines nationales
 * type "Burger King Paris" quand on cherche depuis Nice).
 */
async function detectCityContext(loc: LatLng): Promise<{
  countryCode: string | null;
  cityName: string | null;
  cityBbox: { south: number; west: number; north: number; east: number } | null;
}> {
  let countryCode: string | null = null;
  let cityName: string | null = null;
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
    const first = results[0];
    countryCode = first?.isoCountryCode?.toLowerCase() ?? null;
    // Apple renvoie city, Google peut renvoyer subregion ou district selon la
    // hierarchie administrative. On prend la valeur la plus specifique dispo.
    cityName = first?.city ?? first?.subregion ?? first?.district ?? null;
  } catch {
    return { countryCode: null, cityName: null, cityBbox: null };
  }

  if (!countryCode || !cityName) {
    return { countryCode, cityName, cityBbox: null };
  }

  // Nominatim query pour recuperer la bbox de la ville. On envoie city +
  // countrycodes pour eviter les ambiguites (Nice France vs Nice US).
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('city', cityName);
    url.searchParams.set('countrycodes', countryCode);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('accept-language', 'fr');
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Tolle/1.0 (contact@tolle.bf)' },
    });
    if (!res.ok) return { countryCode, cityName, cityBbox: null };
    const data = (await res.json()) as Array<{
      // Nominatim format: [south, north, west, east]
      boundingbox: [string, string, string, string];
    }>;
    const first = data[0];
    if (!first?.boundingbox) return { countryCode, cityName, cityBbox: null };
    return {
      countryCode,
      cityName,
      cityBbox: {
        south: parseFloat(first.boundingbox[0]),
        north: parseFloat(first.boundingbox[1]),
        west: parseFloat(first.boundingbox[2]),
        east: parseFloat(first.boundingbox[3]),
      },
    };
  } catch {
    return { countryCode, cityName, cityBbox: null };
  }
}

/**
 * Position GPS courante de l'utilisateur (client ou livreur).
 * Recuperee une fois au démarrage de l'app puis rafraichie a la demande.
 *
 * Utilisee pour :
 *  - Centre par defaut de la carte (au lieu de OUAGADOUGOU_CENTER hardcode)
 *  - Bias des recherches Nominatim (priorise les adresses proches)
 *  - Recherche des livreurs proches (côté client)
 *
 * Si la permission est refusée ou que le GPS n'est pas dispo, on retombe
 * sur OUAGADOUGOU_CENTER comme fallback raisonnable (l'app est BF-first
 * mais fonctionne partout).
 */
interface CityBbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface LocationState {
  current: LatLng | null;
  /** Code ISO 2 du pays detecte depuis la position courante (ex: 'bf', 'fr'). */
  countryCode: string | null;
  /** Nom de la ville detectee (ex: 'Nice', 'Ouagadougou'). */
  cityName: string | null;
  /** Bbox de la ville (Nominatim) pour restreindre strictement l'autocomplete. */
  cityBbox: CityBbox | null;
  permissionGranted: boolean;
  isLoading: boolean;
  /** Refresh la position. Demande la permission si pas encore accordee. */
  refresh: () => Promise<LatLng | null>;
  /** Position avec fallback sur Ouagadougou si pas de GPS. */
  getCenterOrFallback: () => LatLng;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  current: null,
  countryCode: null,
  cityName: null,
  cityBbox: null,
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
      // Detection pays + ville + bbox en background (non-bloquant). La
      // resolution Nominatim peut prendre 1-2 secondes, on n'attend pas.
      detectCityContext(loc)
        .then(({ countryCode, cityName, cityBbox }) => {
          set({
            countryCode,
            cityName,
            cityBbox,
          });
        })
        .catch(() => {});
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
