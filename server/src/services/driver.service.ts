import { prisma } from '../lib/prisma.js';
import { haversineKm } from '../utils/geo.js';
import { emitToUser } from './notification.service.js';
import { sendPushToUser } from './push.service.js';
import { logger } from '../lib/logger.js';
import { HttpError } from '../utils/response.js';
import {
  logDriverLocation,
  shouldLogHeartbeat,
} from './location-log.service.js';
import { getAppSettings } from './settings.service.js';

// Defaults si AppSettings indisponible. Les vraies valeurs sont lues via
// getRadiusKm() / getActiveDriverMaxAgeMs() qui consultent la DB (cache 30s).
const DEFAULT_NEARBY_RADIUS_KM = 5;
const DEFAULT_ACTIVE_DRIVER_MAX_AGE_MS = 120 * 1000;
const PENDING_LOOKBACK_MS = 30 * 60 * 1000; // 30 min (non parametrable pour l'instant)

async function getRadiusKm(): Promise<number> {
  try {
    const s = await getAppSettings();
    return s.nearbyRadiusKm;
  } catch {
    return DEFAULT_NEARBY_RADIUS_KM;
  }
}

async function getActiveDriverMaxAgeMs(): Promise<number> {
  try {
    const s = await getAppSettings();
    return s.driverHeartbeatMaxAgeSeconds * 1000;
  } catch {
    return DEFAULT_ACTIVE_DRIVER_MAX_AGE_MS;
  }
}

export async function setOnline(userId: string, isOnline: boolean) {
  // Empeche un livreur non active par l'admin de passer en ligne.
  if (isOnline) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    if (!user?.isActive) {
      throw new HttpError(
        403,
        'DRIVER_NOT_ACTIVATED',
        "Votre compte n'est pas encore active par l'administrateur.",
      );
    }
  }

  const profile = await prisma.driverProfile.update({
    where: { userId },
    data: { isOnline },
  });

  // Tracabilite : on log la position actuelle du livreur quand il passe en ligne
  // ou hors ligne (permet de savoir a partir d'ou il s'est connecte en cas d'incident).
  if (profile.currentLat != null && profile.currentLng != null) {
    void logDriverLocation({
      driverId: userId,
      latitude: profile.currentLat,
      longitude: profile.currentLng,
      event: isOnline ? 'online' : 'offline',
    });
  }

  // Si le livreur vient de passer en ligne et qu'il a une position connue,
  // on lui envoie les livraisons pending dans sa zone (creees il y a moins de 30 min).
  if (isOnline && profile.currentLat != null && profile.currentLng != null) {
    // Transition online -> push autorise pour informer le livreur des
    // courses dispo dans sa zone.
    void notifyPendingDeliveriesToDriver(
      userId,
      profile.currentLat,
      profile.currentLng,
      { sendPush: true },
    ).catch((err) =>
      logger.error({ err, userId }, 'Failed to notify pending deliveries'),
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

    // Tracabilite : enregistre un heartbeat toutes les 5 minutes (pas plus)
    // pour reconstituer le parcours en cas d'incident.
    void (async () => {
      if (await shouldLogHeartbeat(userId)) {
        await logDriverLocation({
          driverId: userId,
          latitude,
          longitude,
          event: 'heartbeat',
        });
      }
    })();
  }

  // 📍 SUIVI TEMPS REEL CLIENT : si le livreur a une course active, on forward
  // sa position au client (sender) pour qu'il voie le marker bouger sur sa carte.
  //
  // Cette branche existe AUSSI dans le socket handler `driver:update_location`,
  // mais on la duplique ici via le path HTTP pour la robustesse : si le socket
  // du livreur est mort au moment du tick (zone flaky, ecran verrouille, app
  // backgrounded), le heartbeat HTTP arrive quand meme et le client recoit la
  // mise a jour. Le sender peut donc recevoir un evenement par les deux chemins
  // (idempotent cote client : juste set la meme position).
  void (async () => {
    try {
      const activeDelivery = await prisma.delivery.findFirst({
        where: {
          driverId: userId,
          status: { in: ['accepted', 'picking_up', 'picked_up', 'delivering'] },
        },
        select: { id: true, senderId: true },
      });
      if (activeDelivery) {
        const { emitToUser } = await import('./notification.service.js');
        emitToUser(activeDelivery.senderId, 'delivery:driver_location', {
          deliveryId: activeDelivery.id,
          driverId: userId,
          latitude,
          longitude,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      logger.warn({ err, userId }, 'Failed to forward driver location to sender');
    }
  })();

  return profile;
}

/**
 * Cherche les livraisons 'pending' dans le rayon du livreur et les emet via Socket.
 * Evite d'emettre plusieurs fois la meme (bonus: le client Socket doit deduper de son cote si besoin).
 */
export async function notifyPendingDeliveriesToDriver(
  userId: string,
  lat: number,
  lng: number,
  /**
   * Si true, envoie un push notification recapitulatif ("X courses disponibles
   * près de vous"). A reserver au moment ou le livreur passe online — sinon
   * on spam le livreur a chaque update de location (toutes les 10s).
   */
  options: { sendPush?: boolean } = {},
) {
  const cutoff = new Date(Date.now() - PENDING_LOOKBACK_MS);
  const radiusKm = await getRadiusKm();

  // Bounding box pour pre-filtrer en SQL
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);

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
    if (dist > radiusKm) continue;
    const { validationCode: _vc, ...safe } = delivery;
    emitToUser(userId, 'delivery:new_request', safe);
    count++;
  }

  if (count > 0) {
    logger.info(
      { userId, count, withPush: !!options.sendPush },
      'Sent pending deliveries to online driver',
    );
    // Push UNIQUEMENT au transition online (sendPush=true). Sinon on
    // spammerait le livreur a chaque heartbeat de position.
    if (options.sendPush) {
      void sendPushToUser(
        userId,
        'Demandes en attente',
        count === 1
          ? 'Une course est disponible près de vous'
          : `${count} courses sont disponibles près de vous`,
        { type: 'pending_batch', count },
      ).catch(() => {});
    }
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

  const maxAgeMs = await getActiveDriverMaxAgeMs();
  const activeCutoff = new Date(Date.now() - maxAgeMs);
  const candidates = await prisma.driverProfile.findMany({
    where: {
      isOnline: true,
      // Livreur actif: sa position doit etre fraiche.
      // Un livreur qui a ferme l'app sans toggle offline sera exclu.
      lastLocationUpdate: { gte: activeCutoff },
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

export interface MapDriver {
  id: string;
  lat: number;
  lng: number;
  status: 'online' | 'offline';
}

/**
 * Livreurs proches POUR LA CARTE D'ACCUEIL (décorative) : en ligne ET hors ligne
 * récents, avec leur statut. Coordonnées ARRONDIES (~3 décimales ≈ 110 m) pour
 * ne pas exposer la position exacte d'une personne sur un écran public. Bornée
 * en récence (2h) pour ne pas afficher de vieilles positions, et plafonnée.
 *
 *  - en ligne (isOnline + position fraîche) → 'online' (vert)
 *  - sinon (position < 2h mais hors ligne / stale) → 'offline' (gris)
 */
export async function findNearbyDriversForMap(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<MapDriver[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  // Récence large (2h) juste pour AVOIR une position à afficher. Le STATUT
  // (vert/gris) ne dépend QUE de isOnline (seule vérité, contrôlée par le user).
  const recentCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const candidates = await prisma.driverProfile.findMany({
    where: {
      lastLocationUpdate: { gte: recentCutoff },
      currentLat: { not: null, gte: lat - latDelta, lte: lat + latDelta },
      currentLng: { not: null, gte: lng - lngDelta, lte: lng + lngDelta },
      verificationStatus: { in: ['verified', 'pending'] },
    },
    select: {
      userId: true,
      isOnline: true,
      currentLat: true,
      currentLng: true,
      lastLocationUpdate: true,
      user: { select: { isActive: true } },
    },
  });

  const round = (n: number) => Math.round(n * 1000) / 1000;
  const out: MapDriver[] = [];
  for (const d of candidates) {
    if (!d.user.isActive || d.currentLat == null || d.currentLng == null) continue;
    if (haversineKm(lat, lng, d.currentLat, d.currentLng) > radiusKm) continue;
    out.push({
      id: d.userId,
      lat: round(d.currentLat),
      lng: round(d.currentLng),
      // Vert = en ligne (isOnline), gris = hors ligne. Indépendant de la
      // fraîcheur de la dernière position.
      status: d.isOnline ? 'online' : 'offline',
    });
  }
  // En ligne d'abord, puis plafond.
  out.sort((a, b) => (a.status === b.status ? 0 : a.status === 'online' ? -1 : 1));
  return out.slice(0, 40);
}

export async function getPublicDriverProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { driverProfile: true },
  });
}

/**
 * Observation des livreurs marques "online" mais sans heartbeat recent.
 *
 * ⚠️ NE MUTE PLUS `isOnline`. Ancien comportement : on flippait isOnline=false
 * automatiquement, ce qui causait LE bug bloquant prod : sur une simple
 * deconnexion socket flaky (transport close / ping timeout ~100s en zone
 * reseau instable), le cron forcait le livreur offline meme si l'app etait
 * toujours en route et le tracking GPS continuait. Pour recevoir a nouveau
 * des courses il fallait toggle off/on manuellement.
 *
 * `isOnline` est desormais controle UNIQUEMENT par le user (toggle dans
 * l'app) ou par un logout/uninstall explicite. La fraicheur GPS est deja
 * filtree dans `findNearbyDrivers` (lastLocationUpdate >= activeCutoff),
 * donc les livreurs "zombies" (app fermee, plus de heartbeat) ne reçoivent
 * naturellement plus de courses sans qu'on ait besoin de muter leur etat.
 *
 * On garde ce hook pour logguer la presence eventuelle de livreurs stale
 * (utile pour le monitoring) mais sans effet de bord destructif.
 */
export async function markStaleDriversOffline() {
  const maxAgeMs = await getActiveDriverMaxAgeMs();
  const cutoff = new Date(Date.now() - maxAgeMs);
  const stale = await prisma.driverProfile.count({
    where: {
      isOnline: true,
      OR: [
        { lastLocationUpdate: { lt: cutoff } },
        { lastLocationUpdate: null },
      ],
    },
  });
  if (stale > 0) {
    logger.debug(
      { count: stale, cutoffMs: maxAgeMs },
      'Stale online drivers detected (no auto-offline, filtered by findNearbyDrivers)',
    );
  }
}
