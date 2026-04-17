import {
  Delivery,
  DeliveryDraft,
  DeliveryStatus,
  DriverWithProfile,
  LatLng,
  PackageType,
  PriceEstimate,
} from '@/types';
import { api, unwrap } from './api.client';

export async function createDelivery(draft: DeliveryDraft, _senderId: string): Promise<Delivery> {
  if (
    !draft.packageType ||
    !draft.pickupLocation ||
    !draft.deliveryLocation ||
    !draft.recipientName ||
    !draft.recipientPhone
  ) {
    throw new Error('Informations manquantes');
  }

  const payload = {
    packageType: draft.packageType,
    packageDescription: draft.packageDescription,
    recipientName: draft.recipientName,
    recipientPhone: draft.recipientPhone,
    pickupAddress: draft.pickupAddress || '',
    pickupDetails: draft.pickupDetails,
    pickupLat: draft.pickupLocation.latitude,
    pickupLng: draft.pickupLocation.longitude,
    deliveryAddress: draft.deliveryAddress || '',
    deliveryDetails: draft.deliveryDetails,
    deliveryLat: draft.deliveryLocation.latitude,
    deliveryLng: draft.deliveryLocation.longitude,
  };

  const res = await api.post('/deliveries', payload);
  return normalizeDelivery(unwrap<any>(res));
}

export async function searchNearbyDrivers(
  pickupLocation: LatLng,
  radiusKm: number = 5
): Promise<DriverWithProfile[]> {
  const res = await api.get('/drivers/nearby', {
    params: {
      lat: pickupLocation.latitude,
      lng: pickupLocation.longitude,
      radiusKm,
    },
  });
  const drivers = unwrap<any[]>(res);
  return drivers.map(normalizeDriver);
}

export async function autoSearchDriver(_deliveryId: string): Promise<DriverWithProfile | null> {
  // Avec backend reel, la notification est envoyee automatiquement via Socket.IO
  // au moment du POST /deliveries. Le livreur accepte de son cote.
  // Cette fonction est gardee pour compatibilite - elle ne fait plus rien ici.
  return null;
}

export async function getDeliveries(
  _userId: string,
  role: 'client' | 'driver',
  statusFilter?: DeliveryStatus
): Promise<Delivery[]> {
  const res = await api.get('/deliveries', {
    params: {
      role: role === 'client' ? 'sender' : 'driver',
      ...(statusFilter ? { status: statusFilter } : {}),
    },
  });
  const list = unwrap<any[]>(res);
  return list.map(normalizeDelivery);
}

export async function getDeliveryById(id: string): Promise<Delivery | null> {
  try {
    const res = await api.get(`/deliveries/${id}`);
    return normalizeDelivery(unwrap<any>(res));
  } catch {
    return null;
  }
}

export async function updateDeliveryStatus(
  id: string,
  status: DeliveryStatus
): Promise<Delivery | null> {
  let url: string;
  switch (status) {
    case 'accepted':
      url = `/deliveries/${id}/accept`;
      break;
    case 'cancelled':
      url = `/deliveries/${id}/cancel`;
      break;
    default:
      return getDeliveryById(id);
  }

  try {
    const res = await api.put(url);
    return normalizeDelivery(unwrap<any>(res));
  } catch {
    return null;
  }
}

export async function confirmPickup(
  deliveryId: string,
  photoUrl: string
): Promise<Delivery | null> {
  try {
    const res = await api.put(`/deliveries/${deliveryId}/pickup-confirm`, { photoUrl });
    return normalizeDelivery(unwrap<any>(res));
  } catch {
    return null;
  }
}

export async function validateDeliveryCode(
  deliveryId: string,
  code: string
): Promise<{ success: boolean; delivery?: Delivery }> {
  try {
    const res = await api.put(`/deliveries/${deliveryId}/validate-code`, { code });
    return { success: true, delivery: normalizeDelivery(unwrap<any>(res)) };
  } catch {
    return { success: false };
  }
}

export async function getPriceEstimate(
  packageType: PackageType,
  pickup: LatLng,
  delivery: LatLng
): Promise<PriceEstimate> {
  const res = await api.get('/deliveries/estimate', {
    params: {
      packageType,
      pickupLat: pickup.latitude,
      pickupLng: pickup.longitude,
      deliveryLat: delivery.latitude,
      deliveryLng: delivery.longitude,
    },
  });
  return unwrap(res);
}

export async function rateDelivery(
  deliveryId: string,
  score: number,
  comment?: string
): Promise<void> {
  await api.post(`/deliveries/${deliveryId}/rate`, { score, comment });
}

// ---------- Normalizers (API shape -> mobile shape) ----------

function normalizeDelivery(raw: any): Delivery {
  return {
    id: raw.id,
    reference: raw.reference,
    senderId: raw.senderId,
    driverId: raw.driverId ?? undefined,
    packageType: raw.packageType,
    packageDescription: raw.packageDescription ?? undefined,
    packagePhotoPickupUrl: raw.packagePhotoPickupUrl ?? undefined,
    packagePhotoDeliveryUrl: raw.packagePhotoDeliveryUrl ?? undefined,
    recipientName: raw.recipientName,
    recipientPhone: raw.recipientPhone,
    pickupAddress: raw.pickupAddress,
    pickupDetails: raw.pickupDetails ?? undefined,
    pickupLocation: { latitude: Number(raw.pickupLat), longitude: Number(raw.pickupLng) },
    deliveryAddress: raw.deliveryAddress,
    deliveryDetails: raw.deliveryDetails ?? undefined,
    deliveryLocation: {
      latitude: Number(raw.deliveryLat),
      longitude: Number(raw.deliveryLng),
    },
    estimatedDistanceKm: raw.estimatedDistanceKm != null ? Number(raw.estimatedDistanceKm) : undefined,
    price: raw.price,
    driverCommission: raw.driverCommission ?? undefined,
    platformFee: raw.platformFee ?? undefined,
    tip: raw.tip ?? 0,
    validationCode: raw.validationCode,
    status: raw.status,
    acceptedAt: raw.acceptedAt ?? undefined,
    pickedUpAt: raw.pickedUpAt ?? undefined,
    deliveredAt: raw.deliveredAt ?? undefined,
    cancelledAt: raw.cancelledAt ?? undefined,
    expiresAt: raw.expiresAt ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeDriver(raw: any): DriverWithProfile {
  const profile = raw.driverProfile || {};
  return {
    id: raw.id,
    phone: raw.phone,
    fullName: raw.fullName,
    email: raw.email ?? undefined,
    userType: raw.userType,
    avatarUrl: raw.avatarUrl ?? undefined,
    isVerified: raw.isVerified,
    isActive: raw.isActive,
    ratingAvg: Number(raw.ratingAvg),
    ratingCount: raw.ratingCount,
    createdAt: raw.createdAt,
    distance: raw.distance ?? profile.distance,
    driverProfile: {
      id: profile.id,
      userId: profile.userId,
      cnibNumber: profile.cnibNumber ?? undefined,
      cnibPhotoUrl: profile.cnibPhotoUrl ?? undefined,
      vehicleType: profile.vehicleType,
      licenseNumber: profile.licenseNumber ?? undefined,
      licensePhotoUrl: profile.licensePhotoUrl ?? undefined,
      isOnline: profile.isOnline,
      currentLocation:
        profile.currentLat != null && profile.currentLng != null
          ? { latitude: Number(profile.currentLat), longitude: Number(profile.currentLng) }
          : undefined,
      lastLocationUpdate: profile.lastLocationUpdate ?? undefined,
      walletBalance: profile.walletBalance ?? 0,
      totalDeliveries: profile.totalDeliveries ?? 0,
      verificationStatus: profile.verificationStatus,
    },
  };
}
