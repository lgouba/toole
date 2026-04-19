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

// --------- KYC ----------

export interface DriverKyc {
  vehicleType: 'moto' | 'velo' | 'voiture' | 'tricycle';
  vehiclePlate: string | null;
  vehiclePhotoUrl: string | null;
  cnibNumber: string | null;
  cnibPhotoUrl: string | null;
  licenseNumber: string | null;
  licensePhotoUrl: string | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationNote: string | null;
  verifiedAt: string | null;
}

function normalizeKyc(raw: any): DriverKyc {
  return {
    vehicleType: raw.vehicleType,
    vehiclePlate: raw.vehiclePlate ?? null,
    vehiclePhotoUrl: raw.vehiclePhotoUrl ?? null,
    cnibNumber: raw.cnibNumber ?? null,
    cnibPhotoUrl: raw.cnibPhotoUrl ?? null,
    licenseNumber: raw.licenseNumber ?? null,
    licensePhotoUrl: raw.licensePhotoUrl ?? null,
    verificationStatus: raw.verificationStatus,
    verificationNote: raw.verificationNote ?? null,
    verifiedAt: raw.verifiedAt ?? null,
  };
}

export async function getMyKyc(): Promise<DriverKyc | null> {
  try {
    const res = await api.get('/drivers/me/kyc');
    return normalizeKyc(unwrap<any>(res));
  } catch {
    return null;
  }
}

export async function updateMyKyc(patch: Partial<DriverKyc>): Promise<DriverKyc | null> {
  try {
    const res = await api.put('/drivers/me/kyc', patch);
    return normalizeKyc(unwrap<any>(res));
  } catch {
    return null;
  }
}
