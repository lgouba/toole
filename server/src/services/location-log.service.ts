import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export type LocationEvent =
  | 'online'
  | 'offline'
  | 'heartbeat'
  | 'accept'
  | 'pickup'
  | 'delivered'
  | 'cancel';

/**
 * Enregistre une position GPS du livreur avec le contexte d'evenement.
 * Utilise pour la tracabilite (incidents, litiges, reconstitution de parcours).
 *
 * Ne jette jamais d'exception : si l'ecriture echoue on log mais on ne casse pas
 * le flow business principal (ex: accepter une course ne doit pas echouer juste
 * parce qu'on n'arrive pas a loger).
 */
export async function logDriverLocation(params: {
  driverId: string;
  latitude: number;
  longitude: number;
  event: LocationEvent;
  deliveryId?: string;
}): Promise<void> {
  try {
    await prisma.driverLocationLog.create({
      data: {
        driverId: params.driverId,
        latitude: params.latitude,
        longitude: params.longitude,
        event: params.event,
        deliveryId: params.deliveryId ?? null,
      },
    });
  } catch (err) {
    logger.warn({ err, ...params }, 'Failed to log driver location');
  }
}

/**
 * Minutes entre deux heartbeat logs. On ne log pas chaque update de position
 * (toutes les 10s), sinon la table explose. 5 min est un bon compromis entre
 * granularite du trace et volume de donnees.
 */
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Decide si on doit logger un nouveau heartbeat pour ce driver.
 * Compare avec le dernier log 'heartbeat' / 'online' pour voir si 5 min se
 * sont ecoulees.
 */
export async function shouldLogHeartbeat(driverId: string): Promise<boolean> {
  try {
    const last = await prisma.driverLocationLog.findFirst({
      where: {
        driverId,
        event: { in: ['heartbeat', 'online'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!last) return true;
    return Date.now() - last.createdAt.getTime() >= HEARTBEAT_INTERVAL_MS;
  } catch {
    return false;
  }
}
