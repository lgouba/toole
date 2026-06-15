import { LatLng } from '@/types';

export type Which = 'pickup' | 'dropoff';

export type PlaceSource = 'gps' | 'saved' | 'recent' | 'search' | 'pasted_link';

export interface Step2Place {
  label: string;
  address?: string;
  location: LatLng;
  source: PlaceSource;
}
