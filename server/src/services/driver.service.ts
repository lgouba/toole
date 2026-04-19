import { prisma } from '../lib/prisma.js';
import { haversineKm } from '../utils/geo.js';
import { emitToUser } from './notification.service.js';
import { sendPushToUser } from './push.service.js';
import { logger } from '../lib/logger.js';

const NEARBY_RADIUS_KM = 5;
const PENDING_LOOKBACK_MS = 30 * 60 * 1000; // 30 min

export async function setOnline(userId: string, isOnline: boolean) {
  const profile = await prisma.driverProfile.update({
    where: { userId },
    data: { isOnline },
  });

  // Si le livreur vient de passer en ligne et qu'il a une position connue,
  // on lui envoie les livraisons pending dans sa zone (creees il y a moins de 30 min).
  if (isOnline && profile.currentLat != null && profile.currentLng != null) {
    void notifyPendingDeliveriesToDriver(userId, profile.currentLat, profile.currentLng).catch(
      (err) => logger.error({ err, userId }, 'Failed to notify pending deliveries'),
    );
  }

  return profile;
}

export async function updateLocation(
  userId: string,
  latitude: number,
  longitude: number,
) {
  const profile = await prisma.driverProfile.update({
    where: { userId },
    data: {
      currentLat: latitude,
      currentLng: longitude,
      lastLocationUpdate: new Date(),
    },
  });

  // Si le livreur est deja en ligne, on lui re-pousse les livraisons pending dans sa nouvelle zone.
  if (profile.isOnline) {
    void notifyPendingDeliveriesToDriver(userId, latitude, longitude).catch((err) =>
      logger.error({ err, userId }, 'Failed to notify pending deliveries on location update'),
    );
  }

  return profile;
}

/**
 * Cherche les livraisons 'pending' dans le rayon du livreur et les emet via Socket.
 * Evite d'emettre plusieurs fois la meme (bonus: le client Socket doit deduper de son cote si besoin).
 */
async function notifyPendingDeliveriesToDriver(
  userId: string,
  lat: number,
  lng: number,
) {
  const cutoff = new Date(Date.now() - PENDING_LOOKBACK_MS);

  // Bounding box pour pre-filtrer en SQL
  const latDelta = NEARBY_RADIUS_KM / 111;
  const lngDelta = NEARBY_RADIUS_KM / (111 * Math.cos((lat * Math.PI) / 180) || 1);

  const pendings = await prisma.delivery.findMany({
    where: {
      status: 'pending',
      createdAt: { gte: cutoff },
      pickupLat: { gte: lat - latDelta, lte: lat + latDelta },
      pickupLng: { gte: lng - lngDelta, lte: lng + lngDelta },
    },
    orderBy: { createdAt: 'desc' },
  });

  let count = 0;
  for (const delivery of pendings) {
    const dist = haversineKm(lat, lng, delivery.pickupLat, delivery.pickupLng);
    if (dist > NEARBY_RADIUS_KM) continue;
    const { validationCode: _vc, ...safe } = delivery;
    emitToUser(userId, 'delivery:new_request', safe);
    count++;
  }

  if (count > 0) {
    logger.info({ userId, count }, 'Sent pending deliveries to online driver');
    // Push unique: "X demandes vous attendent"
    void sendPushToUser(
      userId,
      'Demandes en attente',
      count === 1
        ? 'Une course est disponible pres de vous'
        : `${count} courses sont disponibles pres de vous`,
      { type: 'pending_batch', count },
    ).catch(() => {});
  }
}

export interface NearbyDriver {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  vehicleType: string;
  ratingAvg: number;
  distanceKm: number;
  currentLat: number;
  currentLng: number;
}

export async function findNearbyDrivers(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<NearbyDriver[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);

  const candidates = await prisma.driverProfile.findMany({
    where: {
      isOnline: true,
      currentLat: { not: null, gte: lat - latDelta, lte: lat + latDelta },
      currentLng: { not: null, gte: lng - lngDelta, lte: lng + lngDelta },
      verificationStatus: { in: ['verified', 'pending'] },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          ratingAvg: true,
          isActive: true,
        },
      },
    },
  });

  const results: NearbyDriver[] = [];
  for (const d of candidates) {
    if (!d.user.isActive || d.currentLat == null || d.currentLng == null) continue;
    const distanceKm = haversineKm(lat, lng, d.currentLat, d.currentLng);
    if (distanceKm <= radiusKm) {
      results.push({
        userId: d.user.id,
        fullName: d.user.fullName,
        avatarUrl: d.user.avatarUrl,
        vehicleType: d.vehicleType,
        ratingAvg: Number(d.user.ratingAvg),
        distanceKm: Math.round(distanceKm * 10) / 10,
        currentLat: d.currentLat,
        currentLng: d.currentLng,
      });
    }
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}

export async function getPublicDriverProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { driverProfile: true },
  });
}
