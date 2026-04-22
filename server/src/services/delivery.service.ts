import { Delivery, DeliveryStatus, PackageType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateReference, generateValidationCode, haversineKm } from '../utils/geo.js';
import { calculatePrice } from '../utils/pricing.js';
import { HttpError } from '../utils/response.js';
import { emitToUser, emitToUsers } from './notification.service.js';
import { findNearbyDrivers } from './driver.service.js';
import { sendPushToUser } from './push.service.js';
import { logger } from '../lib/logger.js';
import { logDriverLocation } from './location-log.service.js';

const DELIVERY_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes to find a driver
const NEARBY_RADIUS_KM = 5;

export interface CreateDeliveryInput {
  senderId: string;
  packageType: PackageType;
  packageDescription?: string;
  recipientName: string;
  recipientPhone: string;
  pickupAddress: string;
  pickupDetails?: string;
  pickupLat: number;
  pickupLng: number;
  deliveryAddress: string;
  deliveryDetails?: string;
  deliveryLat: number;
  deliveryLng: number;
  /** Si fourni (future date), la livraison est programmee et diffusee a cette heure-la. */
  scheduledFor?: Date;
}

export async function createDelivery(input: CreateDeliveryInput): Promise<Delivery> {
  const distanceKm = haversineKm(
    input.pickupLat,
    input.pickupLng,
    input.deliveryLat,
    input.deliveryLng,
  );
  const pricing = await calculatePrice(input.packageType, distanceKm);

  // Si la date programmee est dans plus de 5 min, on cree en status 'scheduled'.
  // Sinon on bascule en 'pending' direct (diffusion immediate).
  const now = Date.now();
  const isScheduled =
    input.scheduledFor && input.scheduledFor.getTime() - now > 5 * 60 * 1000;

  const delivery = await prisma.delivery.create({
    data: {
      reference: generateReference(),
      senderId: input.senderId,
      packageType: input.packageType,
      packageDescription: input.packageDescription,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      pickupAddress: input.pickupAddress,
      pickupDetails: input.pickupDetails,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      deliveryAddress: input.deliveryAddress,
      deliveryDetails: input.deliveryDetails,
      deliveryLat: input.deliveryLat,
      deliveryLng: input.deliveryLng,
      estimatedDistanceKm: new Prisma.Decimal(pricing.distanceKm),
      price: pricing.price,
      driverCommission: pricing.driverCommission,
      platformFee: pricing.platformFee,
      validationCode: generateValidationCode(),
      status: isScheduled ? 'scheduled' : 'pending',
      scheduledFor: input.scheduledFor ?? null,
      expiresAt: isScheduled
        ? null // l'expiresAt sera pose au moment de la diffusion
        : new Date(now + DELIVERY_EXPIRY_MS),
    },
  });

  // Si pas programme, notifier les livreurs immediatement
  if (!isScheduled) {
    void notifyNearbyDrivers(delivery).catch((err) =>
      logger.error({ err, deliveryId: delivery.id }, 'Failed to notify nearby drivers'),
    );
  }

  return delivery;
}

/**
 * Scheduler : toutes les 60s, passe les livraisons programmees dont l'heure
 * est arrivee en status 'pending' et les diffuse aux livreurs proches.
 */
export async function processScheduledDeliveries() {
  const now = new Date();
  const due = await prisma.delivery.findMany({
    where: {
      status: 'scheduled',
      scheduledFor: { lte: now },
    },
  });

  for (const d of due) {
    try {
      const updated = await prisma.delivery.update({
        where: { id: d.id },
        data: {
          status: 'pending',
          expiresAt: new Date(Date.now() + DELIVERY_EXPIRY_MS),
        },
      });
      logger.info({ deliveryId: d.id }, 'Scheduled delivery activated');
      // Notifie le client que sa course programmee est maintenant diffusee
      emitToUser(updated.senderId, 'delivery:status_update', updated);
      void sendPushToUser(
        updated.senderId,
        'Course programmee',
        'Nous recherchons un livreur pour votre course planifiee.',
        { type: 'scheduled_started', deliveryId: updated.id },
      ).catch(() => {});
      void notifyNearbyDrivers(updated).catch(() => {});
    } catch (err) {
      logger.error({ err, deliveryId: d.id }, 'Failed to activate scheduled delivery');
    }
  }
}

async function notifyNearbyDrivers(delivery: Delivery) {
  const drivers = await findNearbyDrivers(
    delivery.pickupLat,
    delivery.pickupLng,
    NEARBY_RADIUS_KM,
  );
  const ids = drivers.map((d) => d.userId);
  if (ids.length) {
    const payload = sanitizeForDriver(delivery);
    emitToUsers(ids, 'delivery:new_request', payload);

    // Push notification (pour livreurs avec app fermee)
    const title = 'Nouvelle course Tolle';
    const body = `Recuperation: ${delivery.pickupAddress}`;
    for (const userId of ids) {
      void sendPushToUser(userId, title, body, {
        type: 'new_request',
        deliveryId: delivery.id,
      }).catch(() => {});
    }
  }
  logger.info(
    {
      deliveryId: delivery.id,
      driversNotified: ids.length,
      driverIds: ids,
      driversNames: drivers.map((d) => d.fullName),
    },
    'Notified nearby drivers',
  );
}

function sanitizeForDriver(delivery: Delivery) {
  // Do not leak validation code to drivers before they deliver.
  const { validationCode: _vc, ...rest } = delivery;
  return rest;
}

export async function listDeliveries(args: {
  userId: string;
  role: 'sender' | 'driver';
  status?: DeliveryStatus;
}) {
  const where: Prisma.DeliveryWhereInput = {};
  if (args.role === 'sender') where.senderId = args.userId;
  if (args.role === 'driver') where.driverId = args.userId;
  if (args.status) where.status = args.status;

  return prisma.delivery.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
      driver: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
    },
  });
}

export async function getDeliveryForUser(deliveryId: string, userId: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      sender: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
      driver: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          avatarUrl: true,
          ratingAvg: true,
          driverProfile: {
            select: {
              vehicleType: true,
              currentLat: true,
              currentLng: true,
            },
          },
        },
      },
    },
  });
  if (!delivery) {
    throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  }
  if (delivery.senderId !== userId && delivery.driverId !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'Access denied');
  }
  // Only sender should see validation code
  if (delivery.senderId !== userId) {
    return { ...delivery, validationCode: null };
  }
  return delivery;
}

export async function acceptDelivery(deliveryId: string, driverId: string) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) {
    throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  }
  if (delivery.status !== 'pending') {
    throw new HttpError(400, 'INVALID_STATE', 'Delivery is not pending');
  }
  if (delivery.expiresAt && delivery.expiresAt < new Date()) {
    throw new HttpError(400, 'EXPIRED', 'Delivery request has expired');
  }

  const updated = await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      driverId,
      status: 'accepted',
      acceptedAt: new Date(),
    },
  });

  emitToUser(updated.senderId, 'delivery:accepted', updated);
  emitToUser(driverId, 'delivery:status_update', updated);

  // Push au client : livreur en route (app client en background / ecran eteint)
  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: { fullName: true },
  });
  void sendPushToUser(
    updated.senderId,
    'Livreur en route',
    `${driver?.fullName ?? 'Un livreur'} a accepte votre course`,
    { type: 'delivery_accepted', deliveryId: updated.id },
  ).catch(() => {});

  // Pousse tout de suite la position connue du livreur pour que le client voie
  // son marqueur apparaitre immediatement (sans attendre le prochain heartbeat).
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { currentLat: true, currentLng: true, lastLocationUpdate: true },
  });
  if (
    driverProfile?.currentLat != null &&
    driverProfile.currentLng != null
  ) {
    emitToUser(updated.senderId, 'delivery:driver_location', {
      driverId,
      deliveryId: updated.id,
      latitude: driverProfile.currentLat,
      longitude: driverProfile.currentLng,
      updatedAt: driverProfile.lastLocationUpdate,
    });
    // Tracabilite : log l'acceptation avec position + reference de livraison
    void logDriverLocation({
      driverId,
      latitude: driverProfile.currentLat,
      longitude: driverProfile.currentLng,
      event: 'accept',
      deliveryId: updated.id,
    });
  }

  // Avertir les autres livreurs proches que la course n'est plus disponible
  void (async () => {
    const drivers = await findNearbyDrivers(
      updated.pickupLat,
      updated.pickupLng,
      NEARBY_RADIUS_KM,
    );
    const otherIds = drivers.map((d) => d.userId).filter((id) => id !== driverId);
    if (otherIds.length) {
      emitToUsers(otherIds, 'delivery:invalidated', {
        deliveryId: updated.id,
        reason: 'taken',
      });
    }
  })().catch(() => {});

  return updated;
}

export async function rejectDelivery(deliveryId: string, driverId: string) {
  // No state change — just log. Next-driver fallback is out of scope.
  logger.info({ deliveryId, driverId }, 'Driver rejected delivery');
  return { ok: true };
}

/**
 * Relance une demande expiree ou pending: remet le statut a pending, reinitialise expiresAt
 * et rebroadcast aux livreurs proches.
 */
export async function relaunchDelivery(deliveryId: string, userId: string) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  if (delivery.senderId !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'Access denied');
  }
  if (!['pending', 'expired'].includes(delivery.status)) {
    throw new HttpError(
      400,
      'INVALID_STATE',
      'Seules les demandes en attente ou expirees peuvent etre relancees',
    );
  }

  const updated = await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'pending',
      expiresAt: new Date(Date.now() + DELIVERY_EXPIRY_MS),
    },
  });

  // Re-notify nearby drivers
  void notifyNearbyDrivers(updated).catch((err) =>
    logger.error({ err, deliveryId }, 'Failed to re-notify on relaunch'),
  );

  return updated;
}

export async function confirmPickup(
  deliveryId: string,
  driverId: string,
  photoUrl: string,
) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  if (delivery.driverId !== driverId) {
    throw new HttpError(403, 'FORBIDDEN', 'Not your delivery');
  }
  if (!['accepted', 'picking_up'].includes(delivery.status)) {
    throw new HttpError(400, 'INVALID_STATE', 'Delivery cannot be picked up');
  }
  const updated = await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'picked_up',
      pickedUpAt: new Date(),
      packagePhotoPickupUrl: photoUrl,
    },
  });
  emitToUser(updated.senderId, 'delivery:status_update', updated);
  emitToUser(driverId, 'delivery:status_update', updated);

  // Push au client: colis recupere
  void sendPushToUser(
    updated.senderId,
    'Colis recupere',
    'Votre colis est en route vers le destinataire',
    { type: 'delivery_picked_up', deliveryId: updated.id },
  ).catch(() => {});

  // Tracabilite : log position + event pickup
  const dp = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { currentLat: true, currentLng: true },
  });
  if (dp?.currentLat != null && dp.currentLng != null) {
    void logDriverLocation({
      driverId,
      latitude: dp.currentLat,
      longitude: dp.currentLng,
      event: 'pickup',
      deliveryId: updated.id,
    });
  }

  return updated;
}

export async function validateCode(
  deliveryId: string,
  driverId: string,
  code: string,
) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  if (delivery.driverId !== driverId) {
    throw new HttpError(403, 'FORBIDDEN', 'Not your delivery');
  }
  if (!['picked_up', 'delivering'].includes(delivery.status)) {
    throw new HttpError(400, 'INVALID_STATE', 'Delivery cannot be completed');
  }
  if (delivery.validationCode !== code) {
    throw new HttpError(400, 'INVALID_CODE', 'Validation code is incorrect');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.delivery.update({
      where: { id: deliveryId },
      data: { status: 'delivered', deliveredAt: new Date() },
    });

    if (d.driverCommission && d.driverId) {
      await tx.transaction.create({
        data: {
          userId: d.driverId,
          deliveryId: d.id,
          type: 'commission',
          amount: d.driverCommission,
          paymentMethod: 'wallet',
          status: 'completed',
        },
      });
      await tx.driverProfile.update({
        where: { userId: d.driverId },
        data: {
          walletBalance: { increment: d.driverCommission },
          totalDeliveries: { increment: 1 },
        },
      });
    }
    return d;
  });

  emitToUser(updated.senderId, 'delivery:status_update', updated);
  emitToUser(driverId, 'delivery:status_update', updated);

  // Push au client: livraison terminee (incite a noter)
  void sendPushToUser(
    updated.senderId,
    'Livraison terminee',
    'Votre colis a ete livre. Notez votre livreur !',
    { type: 'delivery_delivered', deliveryId: updated.id },
  ).catch(() => {});

  // Tracabilite : log position + event delivered
  const dp = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { currentLat: true, currentLng: true },
  });
  if (dp?.currentLat != null && dp.currentLng != null) {
    void logDriverLocation({
      driverId,
      latitude: dp.currentLat,
      longitude: dp.currentLng,
      event: 'delivered',
      deliveryId: updated.id,
    });
  }

  return updated;
}

export type CancelReason =
  | 'client_cancelled'
  | 'driver_unavailable'
  | 'driver_too_far'
  | 'package_issue'
  | 'recipient_unreachable'
  | 'no_driver_found'
  | 'other';

export async function cancelDelivery(
  deliveryId: string,
  userId: string,
  reason?: CancelReason,
  comment?: string,
) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  if (delivery.senderId !== userId && delivery.driverId !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'Access denied');
  }
  if (['delivered', 'cancelled', 'expired'].includes(delivery.status)) {
    throw new HttpError(400, 'INVALID_STATE', 'Delivery cannot be cancelled');
  }

  const isDriverCancel = userId === delivery.driverId;
  const canReassignToOthers =
    isDriverCancel &&
    delivery.status !== 'picked_up' &&
    delivery.status !== 'delivering';

  // Cas special : le livreur annule une course deja acceptee (mais pas encore recuperee)
  // → on remet en pending pour que d'autres livreurs puissent la prendre.
  if (canReassignToOthers) {
    const updated = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: 'pending',
        driverId: null,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + DELIVERY_EXPIRY_MS),
      },
    });

    // Avertir le client que le livreur a abandonne et qu'on cherche un autre
    emitToUser(updated.senderId, 'delivery:driver_cancelled', {
      delivery: updated,
      reason: reason ?? 'driver_unavailable',
      comment,
    });

    // Re-notifier les autres livreurs proches
    void notifyNearbyDrivers(updated).catch((err) =>
      logger.error({ err, deliveryId }, 'Failed to re-notify after driver cancel'),
    );

    logger.info({ deliveryId, driverId: userId, reason }, 'Driver cancelled, re-posted');
    return updated;
  }

  // Sinon: annulation definitive
  const updated = await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: reason,
      cancelComment: comment,
      cancelledBy: userId,
    },
  });

  // Si la livraison etait encore pending, elle a ete broadcastee aux livreurs proches:
  // il faut les avertir qu'elle n'est plus disponible.
  if (delivery.status === 'pending') {
    void broadcastDeliveryInvalidation(delivery, 'cancelled').catch((err) =>
      logger.error({ err, deliveryId }, 'Failed to broadcast cancellation'),
    );
  }

  const otherParty =
    userId === updated.senderId ? updated.driverId : updated.senderId;
  if (otherParty) emitToUser(otherParty, 'delivery:cancelled', updated);

  // Tracabilite : si un livreur annule, on log sa position
  if (isDriverCancel && updated.driverId) {
    const dp = await prisma.driverProfile.findUnique({
      where: { userId: updated.driverId },
      select: { currentLat: true, currentLng: true },
    });
    if (dp?.currentLat != null && dp.currentLng != null) {
      void logDriverLocation({
        driverId: updated.driverId,
        latitude: dp.currentLat,
        longitude: dp.currentLng,
        event: 'cancel',
        deliveryId: updated.id,
      });
    }
  }

  return updated;
}

/**
 * Avertit tous les livreurs proches du pickup qu'une demande en attente n'est plus disponible
 * (annulee ou expiree). Ils doivent fermer l'ecran "Nouvelle demande" si affiche.
 */
async function broadcastDeliveryInvalidation(
  delivery: Delivery,
  reason: 'cancelled' | 'expired',
) {
  const drivers = await findNearbyDrivers(
    delivery.pickupLat,
    delivery.pickupLng,
    NEARBY_RADIUS_KM,
  );
  const ids = drivers.map((d) => d.userId);
  if (ids.length) {
    emitToUsers(ids, 'delivery:invalidated', {
      deliveryId: delivery.id,
      reason,
    });
  }
}

/**
 * Scan periodique des livraisons pending expirees et diffusion aux livreurs.
 */
export async function expirePendingDeliveries() {
  const now = new Date();
  const toExpire = await prisma.delivery.findMany({
    where: {
      status: 'pending',
      expiresAt: { lt: now },
    },
  });

  for (const d of toExpire) {
    const updated = await prisma.delivery.update({
      where: { id: d.id },
      data: { status: 'expired' },
    });
    emitToUser(updated.senderId, 'delivery:expired', updated);
    void broadcastDeliveryInvalidation(d, 'expired').catch(() => {});
  }

  if (toExpire.length) {
    logger.info({ count: toExpire.length }, 'Expired pending deliveries');
  }
}

export async function rateDelivery(args: {
  deliveryId: string;
  raterId: string;
  score: number;
  comment?: string;
}) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: args.deliveryId },
  });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  if (delivery.status !== 'delivered') {
    throw new HttpError(400, 'INVALID_STATE', 'Can only rate delivered orders');
  }
  if (
    args.raterId !== delivery.senderId &&
    args.raterId !== delivery.driverId
  ) {
    throw new HttpError(403, 'FORBIDDEN', 'Access denied');
  }
  const ratedId =
    args.raterId === delivery.senderId ? delivery.driverId : delivery.senderId;
  if (!ratedId) {
    throw new HttpError(400, 'INVALID_STATE', 'No counterpart to rate');
  }

  const rating = await prisma.$transaction(async (tx) => {
    const r = await tx.rating.create({
      data: {
        deliveryId: args.deliveryId,
        raterId: args.raterId,
        ratedId,
        score: args.score,
        comment: args.comment,
      },
    });
    // Recompute average
    const agg = await tx.rating.aggregate({
      where: { ratedId },
      _avg: { score: true },
      _count: { _all: true },
    });
    await tx.user.update({
      where: { id: ratedId },
      data: {
        ratingAvg: new Prisma.Decimal(
          Math.round((agg._avg.score ?? 5) * 10) / 10,
        ),
        ratingCount: agg._count._all,
      },
    });
    return r;
  });

  return rating;
}

export async function estimatePrice(
  packageType: PackageType,
  pickupLat: number,
  pickupLng: number,
  deliveryLat: number,
  deliveryLng: number,
) {
  const distanceKm = haversineKm(pickupLat, pickupLng, deliveryLat, deliveryLng);
  return calculatePrice(packageType, distanceKm);
}
