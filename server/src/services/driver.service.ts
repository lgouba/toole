import { prisma } from '../lib/prisma.js';
import { haversineKm } from '../utils/geo.js';

export async function setOnline(userId: string, isOnline: boolean) {
  return prisma.driverProfile.update({
    where: { userId },
    data: { isOnline },
  });
}

export async function updateLocation(
  userId: string,
  latitude: number,
  longitude: number,
) {
  return prisma.driverProfile.update({
    where: { userId },
    data: {
      currentLat: latitude,
      currentLng: longitude,
      lastLocationUpdate: new Date(),
    },
  });
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
  // Rough bounding box to reduce rows. 1 deg latitude ~ 111km.
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);

  const candidates = await prisma.driverProfile.findMany({
    where: {
      isOnline: true,
      currentLat: { not: null, gte: lat - latDelta, lte: lat + latDelta },
      currentLng: { not: null, gte: lng - lngDelta, lte: lng + lngDelta },
      // NOTE: en production, n'accepter que les livreurs "verified".
      // Pour le MVP de test, on accepte aussi "pending" pour que les livreurs tout juste inscrits
      // puissent recevoir des demandes sans attendre une validation manuelle.
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
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      ratingAvg: true,
      ratingCount: true,
      userType: true,
      driverProfile: {
        select: {
          vehicleType: true,
          totalDeliveries: true,
          isOnline: true,
          verificationStatus: true,
        },
      },
    },
  });
}
