import { LatLng } from '@/types';

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function interpolatePosition(from: LatLng, to: LatLng, progress: number): LatLng {
  const t = Math.max(0, Math.min(1, progress));
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * t,
    longitude: from.longitude + (to.longitude - from.longitude) * t,
  };
}

export function generateValidationCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function generateReference(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TLL-${date}-${rand}`;
}

// Ouagadougou center
export const OUAGADOUGOU_CENTER: LatLng = {
  latitude: 12.3714,
  longitude: -1.5197,
};

export const DEFAULT_MAP_REGION = {
  ...OUAGADOUGOU_CENTER,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
