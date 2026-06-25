import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LatLng } from '@/types';

/**
 * Adresses favorites du client : Maison, Bureau, ou personnalisées.
 *
 * Persistance AsyncStorage pour que les favoris survivent au logout/redemarrage.
 * Pas synchronise au backend dans cette phase — uniquement local. On pourra
 * ajouter une table `UserAddress` plus tard si besoin de partager entre devices.
 */
export interface AddressFavorite {
  id: string;
  /** 'home' | 'work' | 'custom' */
  kind: 'home' | 'work' | 'custom';
  /** Nom affiche : "Maison", "Bureau" ou libre (ex: "Mama") */
  label: string;
  /** Texte d'adresse complet (display name Nominatim) */
  address: string;
  /** Coordonnees GPS */
  location: LatLng;
  /** Indication d'acces (porte, etage, ...). Optionnel. */
  details?: string;
  createdAt: string;
}

interface State {
  favorites: AddressFavorite[];
  add: (fav: Omit<AddressFavorite, 'id' | 'createdAt'>) => AddressFavorite;
  /** Upsert par kind pour 'home' et 'work' (un seul par utilisateur).
   *  Pour 'custom', ajoute une nouvelle entree a chaque appel. */
  upsertByKind: (
    fav: Omit<AddressFavorite, 'id' | 'createdAt'>,
  ) => AddressFavorite;
  update: (id: string, patch: Partial<AddressFavorite>) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Helper: récupère l'adresse Maison si elle existe */
  getHome: () => AddressFavorite | undefined;
  getWork: () => AddressFavorite | undefined;
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useAddressFavoritesStore = create<State>()(
  persist(
    (set, get) => ({
      favorites: [],

      add: (fav) => {
        const item: AddressFavorite = {
          ...fav,
          id: genId(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ favorites: [item, ...s.favorites] }));
        return item;
      },

      upsertByKind: (fav) => {
        if (fav.kind === 'custom') return get().add(fav);
        const existing = get().favorites.find((f) => f.kind === fav.kind);
        if (existing) {
          const updated: AddressFavorite = {
            ...existing,
            label: fav.label,
            address: fav.address,
            location: fav.location,
            details: fav.details,
          };
          set((s) => ({
            favorites: s.favorites.map((f) => (f.id === existing.id ? updated : f)),
          }));
          return updated;
        }
        return get().add(fav);
      },

      update: (id, patch) =>
        set((s) => ({
          favorites: s.favorites.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),

      remove: (id) =>
        set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),

      clear: () => set({ favorites: [] }),

      getHome: () => get().favorites.find((f) => f.kind === 'home'),
      getWork: () => get().favorites.find((f) => f.kind === 'work'),
    }),
    {
      name: 'toole:address-favorites',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ favorites: s.favorites }),
    },
  ),
);
