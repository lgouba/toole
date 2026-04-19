import { Delivery, DeliveryStatus, PackageType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateReference, generateValidationCode, haversineKm } from '../utils/geo.js';
import { calculatePrice } from '../utils/pricing.js';
import { HttpError } from '../utils/response.js';
import { emitToUser, emitToUsers } from './notification.service.js';
import { findNearbyDrivers } from './driver.service.js';
import { sendPushToUser } from './push.service.js';
import { logger } from '../lib/logger.js';

const DELIVERY_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes to accept
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
}

export async function createDelivery(input: CreateDeliveryInput): Promise<Delivery> {
  const distanceKm = haversineKm(
    input.pickupLat,
    input.pickupLng,
    input.deliveryLat,
    input.deliveryLng,
  );
  const pricing = calculatePrice(input.packageType, distanceKm);

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
      status: 'pending',
      expiresAt: new Date(Date.now() + DELIVERY_EXPIRY_MS),
    },
  });

  // Notify nearby drivers (fire-and-forget).
  void notifyNearbyDrivers(delivery).catch((err) =>
    logger.error({ err, deliveryId: delivery.id }, 'Failed to notify nearby drivers'),
  );

  return delivery;
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
    { deliveryId: delivery.id, driversNotified: ids.length },
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
  return updated;
}

export async function cancelDelivery(deliveryId: string, userId: string) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  if (delivery.senderId !== userId && delivery.driverId !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'Access denied');
  }
  if (['delivered', 'cancelled', 'expired'].includes(delivery.status)) {
    throw new HttpError(400, 'INVALID_STATE', 'Delivery cannot be cancelled');
  }
  const updated = await prisma.delivery.update({
    where: { id: deliveryId },
    data: { status: 'cancelled', cancelledAt: new Date() },
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

export function estimatePrice(
  packageType: PackageType,
  pickupLat: number,
  pickupLng: number,
  deliveryLat: number,
  deliveryLng: number,
) {
  const distanceKm = haversineKm(pickupLat, pickupLng, deliveryLat, deliveryLng);
  return calculatePrice(packageType, distanceKm);
}
