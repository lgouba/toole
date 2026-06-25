import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LatLng } from '@/types';

/**
 * Lieux récemment choisis par le client (départ ou arrivée), persistés en local.
 * Sert à proposer "Trajets & lieux récents" à l'étape 2. Pas synchronisé backend
 * (cohérent avec addressFavorites). Dédoublonné par coordonnées arrondies (~11m),
 * borné aux 8 plus récents.
 */
export interface RecentPlace {
  label: string;
  address?: string;
  location: LatLng;
  usedAt: string;
}

interface State {
  recents: RecentPlace[];
  addRecent: (p: Omit<RecentPlace, 'usedAt'>) => void;
  clear: () => void;
}

const key = (l: LatLng) => `${l.latitude.toFixed(4)},${l.longitude.toFixed(4)}`;

export const useRecentPlacesStore = create<State>()(
  persist(
    (set) => ({
      recents: [],
      addRecent: (p) =>
        set((s) => {
          const k = key(p.location);
          const deduped = s.recents.filter((r) => key(r.location) !== k);
          return {
            recents: [
              { ...p, usedAt: new Date().toISOString() },
              ...deduped,
            ].slice(0, 8),
          };
        }),
      clear: () => set({ recents: [] }),
    }),
    {
      name: 'toole-recent-places',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
