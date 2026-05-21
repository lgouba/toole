import { DriverWithProfile, LatLng } from '@/types';
import { api, unwrap } from './api.client';

export async function setOnlineStatus(isOnline: boolean): Promise<void> {
  await api.put('/drivers/status', { isOnline });
}

/**
 * Récupéré un livreur public (pour refresh client quand on a perdu un event).
 * Le backend renvoie { ...user, driverProfile: { currentLat, currentLng, ... } }.
 */
export async function getDriverById(
  driverId: string,
): Promise<DriverWithProfile | null> {
  try {
    const res = await api.get(`/drivers/${driverId}`);
    const raw = unwrap<any>(res);
    if (!raw) return null;
    const currentLocation =
      raw.driverProfile?.currentLat != null &&
      raw.driverProfile?.currentLng != null
        ? {
            latitude: Number(raw.driverProfile.currentLat),
            longitude: Number(raw.driverProfile.currentLng),
          }
        : undefined;
    return {
      id: raw.id,
      phone: raw.phone,
      firstName: raw.firstName ?? undefined,
      lastName: raw.lastName ?? undefined,
      fullName: raw.fullName,
      email: raw.email ?? undefined,
      userType: raw.userType,
      avatarUrl: raw.avatarUrl ?? undefined,
      isVerified: !!raw.isVerified,
      isActive: !!raw.isActive,
      ratingAvg: Number(raw.ratingAvg ?? 5),
      ratingCount: Number(raw.ratingCount ?? 0),
      createdAt: raw.createdAt,
      driverProfile: {
        id: raw.driverProfile?.id ?? raw.id,
        userId: raw.id,
        vehicleType: raw.driverProfile?.vehicleType ?? 'moto',
        isOnline: !!raw.driverProfile?.isOnline,
        currentLocation,
        walletBalance: Number(raw.driverProfile?.walletBalance ?? 0),
        totalDeliveries: Number(raw.driverProfile?.totalDeliveries ?? 0),
        verificationStatus: raw.driverProfile?.verificationStatus ?? 'pending',
      },
    };
  } catch {
    return null;
  }
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
  /** Photo verso de la CNIB (alignee avec le KYC d'inscription). */
  cnibPhotoBackUrl: string | null;
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
    cnibPhotoBackUrl: raw.cnibPhotoBackUrl ?? null,
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

// ---------------- Stats livreur ----------------

export interface DriverStatsPeriod {
  deliveredCount: number;
  revenue: number;
  tips: number;
}

export interface DriverStatsDaily {
  date: string;
  revenue: number;
  count: number;
}

export interface DriverStats {
  today: DriverStatsPeriod;
  week: DriverStatsPeriod;
  month: DriverStatsPeriod;
  last30Days: DriverStatsDaily[];
  ratingAvg: number;
  ratingCount: number;
  totalDeliveries: number;
  acceptanceRate: number;
  cancellationRate: number;
  ranking: { position: number; total: number };
}

export async function getMyDriverStats(): Promise<DriverStats | null> {
  try {
    const res = await api.get('/drivers/me/stats');
    return unwrap<DriverStats>(res);
  } catch {
    return null;
  }
}
