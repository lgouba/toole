import { LatLng } from '@/types';
import { api, unwrap } from './api.client';

export async function setOnlineStatus(isOnline: boolean): Promise<void> {
  await api.put('/drivers/status', { isOnline });
}

export async function updateLocation(location: LatLng): Promise<void> {
  await api.put('/drivers/location', {
    latitude: location.latitude,
    longitude: location.longitude,
  });
}
