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

  // Normalise le numero de telephone: garde uniquement les chiffres et prefixe "+" optionnel
  const cleanPhone = (raw: string): string => {
    const cleaned = raw.replace(/\D/g, '');
    // Si l'utilisateur n'a saisi que 8 chiffres (local), on prefixe 226 (Burkina)
    if (cleaned.length === 8) return `226${cleaned}`;
    return cleaned;
  };

  // Fallback adresse: si vide, on utilise les coordonnees GPS
  const fallbackAddress = (
    addr: string | undefined,
    loc: { latitude: number; longitude: number },
  ) =>
    addr && addr.trim().length > 0
      ? addr.trim()
      : `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;

  const payload = {
    packageType: draft.packageType,
    ...(draft.packageDescription ? { packageDescription: draft.packageDescription } : {}),
    recipientName: draft.recipientName.trim(),
    recipientPhone: cleanPhone(draft.recipientPhone),
    pickupAddress: fallbackAddress(draft.pickupAddress, draft.pickupLocation),
    ...(draft.pickupDetails ? { pickupDetails: draft.pickupDetails } : {}),
    pickupLat: draft.pickupLocation.latitude,
    pickupLng: draft.pickupLocation.longitude,
    deliveryAddress: fallbackAddress(draft.deliveryAddress, draft.deliveryLocation),
    ...(draft.deliveryDetails ? { deliveryDetails: draft.deliveryDetails } : {}),
    deliveryLat: draft.deliveryLocation.latitude,
    deliveryLng: draft.deliveryLocation.longitude,
    ...(draft.scheduledFor ? { scheduledFor: draft.scheduledFor } : {}),
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

/**
 * Statuts actifs selon le role :
 *  - Client : 'pending' (recherche en cours) + statuts livraison en cours
 *  - Livreur : statuts livraison en cours uniquement (une demande 'pending'
 *    n'est pas "sa" livraison tant qu'il n'a pas accepte)
 */
const CLIENT_ACTIVE_STATUSES: DeliveryStatus[] = [
  'pending',
  'accepted',
  'picking_up',
  'picked_up',
  'delivering',
];
const DRIVER_ACTIVE_STATUSES: DeliveryStatus[] = [
  'accepted',
  'picking_up',
  'picked_up',
  'delivering',
];

/**
 * Recupere la livraison active courante de l'utilisateur. Utilise pour la
 * navigation guard : si une livraison est en cours et que l'utilisateur est
 * perdu sur un autre ecran, on le ramene automatiquement.
 */
export async function getActiveDelivery(
  role: 'client' | 'driver',
): Promise<Delivery | null> {
  try {
    const res = await api.get('/deliveries', {
      params: {
        role: role === 'client' ? 'sender' : 'driver',
      },
    });
    const list = unwrap<any[]>(res).map(normalizeDelivery);
    const activeStatuses =
      role === 'client' ? CLIENT_ACTIVE_STATUSES : DRIVER_ACTIVE_STATUSES;
    // La liste est en general ordonnee recent->ancien ; on prend la 1re active.
    return (
      list.find((d) => activeStatuses.includes(d.status as DeliveryStatus)) ??
      null
    );
  } catch {
    return null;
  }
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

export async function relaunchDelivery(deliveryId: string): Promise<Delivery | null> {
  try {
    const res = await api.put(`/deliveries/${deliveryId}/relaunch`);
    return normalizeDelivery(unwrap<any>(res));
  } catch {
    return null;
  }
}

export async function cancelDelivery(
  deliveryId: string,
  reason?: string,
  comment?: string,
): Promise<Delivery | null> {
  try {
    const res = await api.put(`/deliveries/${deliveryId}/cancel`, {
      reason,
      comment,
    });
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
    console.log('[confirmPickup] PUT pickup-confirm for', deliveryId);
    const res = await api.put(`/deliveries/${deliveryId}/pickup-confirm`, { photoUrl });
    const delivery = normalizeDelivery(unwrap<any>(res));
    console.log('[confirmPickup] OK, new status =', delivery.status);
    return delivery;
  } catch (err: any) {
    console.warn(
      '[confirmPickup] FAILED',
      err?.response?.status,
      err?.response?.data?.error ?? err?.message,
    );
    throw err;
  }
}

export async function validateDeliveryCode(
  deliveryId: string,
  code: string
): Promise<{ success: boolean; delivery?: Delivery; errorMessage?: string }> {
  try {
    console.log('[validateDeliveryCode] PUT validate-code for', deliveryId);
    const res = await api.put(`/deliveries/${deliveryId}/validate-code`, { code });
    const delivery = normalizeDelivery(unwrap<any>(res));
    console.log('[validateDeliveryCode] OK, new status =', delivery.status);
    return { success: true, delivery };
  } catch (err: any) {
    const status = err?.response?.status;
    const apiMsg = err?.response?.data?.error?.message;
    console.warn(
      '[validateDeliveryCode] FAILED',
      status,
      err?.response?.data?.error ?? err?.message,
    );
    return {
      success: false,
      errorMessage: apiMsg ?? err?.message ?? 'Erreur inconnue',
    };
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
