import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/response.js';
import {
  signAccessToken,
  signRefreshToken,
  refreshTokenExpiry,
} from '../lib/jwt.js';

const BCRYPT_ROUNDS = 10;

/**
 * Login admin via email + password (pas OTP).
 */
export async function adminLogin(email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { email, userType: 'admin' },
  });
  if (!user || !user.passwordHash) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Identifiants invalides');
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Identifiants invalides');
  }
  if (!user.isActive) {
    throw new HttpError(403, 'ACCOUNT_DISABLED', 'Compte desactive');
  }

  const accessToken = signAccessToken({
    userId: user.id,
    userType: user.userType,
  });
  const refreshToken = signRefreshToken({
    userId: user.id,
    userType: user.userType,
  });
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: refreshTokenExpiry(),
    },
  });

  return { user, accessToken, refreshToken };
}

export async function createAdmin(params: {
  email: string;
  fullName: string;
  phone: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);
  return prisma.user.create({
    data: {
      email: params.email,
      fullName: params.fullName,
      phone: params.phone,
      passwordHash,
      userType: 'admin',
      isVerified: true,
      isActive: true,
    },
  });
}

// ---------- Dashboard stats ----------

export async function getDashboardStats() {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const start7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const start30d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const [
    totalClients,
    totalDrivers,
    totalDeliveries,
    deliveredAll,
    deliveredToday,
    deliveredLast7d,
    deliveredLast30d,
    activeDeliveries,
    pendingDeliveries,
    onlineDrivers,
    cancelledLast30d,
    revenueLast30dAgg,
    commissionLast30dAgg,
    newUsersLast7d,
    pendingKyc,
    topDrivers,
    recentDeliveries,
    pendingActivationCount,
    pendingActivationDrivers,
  ] = await Promise.all([
    prisma.user.count({ where: { userType: 'client' } }),
    prisma.user.count({ where: { userType: 'driver' } }),
    prisma.delivery.count(),
    prisma.delivery.count({ where: { status: 'delivered' } }),
    prisma.delivery.count({
      where: { status: 'delivered', deliveredAt: { gte: startToday } },
    }),
    prisma.delivery.count({
      where: { status: 'delivered', deliveredAt: { gte: start7d } },
    }),
    prisma.delivery.count({
      where: { status: 'delivered', deliveredAt: { gte: start30d } },
    }),
    prisma.delivery.count({
      where: {
        status: { in: ['accepted', 'picking_up', 'picked_up', 'delivering'] },
      },
    }),
    prisma.delivery.count({ where: { status: 'pending' } }),
    prisma.driverProfile.count({ where: { isOnline: true } }),
    prisma.delivery.count({
      where: {
        status: { in: ['cancelled', 'expired'] },
        createdAt: { gte: start30d },
      },
    }),
    prisma.delivery.aggregate({
      where: { status: 'delivered', deliveredAt: { gte: start30d } },
      _sum: { price: true },
    }),
    prisma.delivery.aggregate({
      where: { status: 'delivered', deliveredAt: { gte: start30d } },
      _sum: { platformFee: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: start7d } } }),
    prisma.driverProfile.count({ where: { verificationStatus: 'pending' } }),
    prisma.user.findMany({
      where: { userType: 'driver' },
      orderBy: { ratingAvg: 'desc' },
      take: 5,
      include: { driverProfile: true },
    }),
    prisma.delivery.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        sender: { select: { id: true, fullName: true, phone: true } },
        driver: { select: { id: true, fullName: true, phone: true } },
      },
    }),
    prisma.user.count({
      where: { userType: 'driver', isActive: false, suspendedAt: null },
    }),
    prisma.user.findMany({
      where: { userType: 'driver', isActive: false, suspendedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { driverProfile: true },
    }),
  ]);

  return {
    users: {
      clients: totalClients,
      drivers: totalDrivers,
      newLast7d: newUsersLast7d,
    },
    deliveries: {
      total: totalDeliveries,
      deliveredAll,
      deliveredToday,
      deliveredLast7d,
      deliveredLast30d,
      active: activeDeliveries,
      pending: pendingDeliveries,
      cancelledLast30d,
    },
    drivers: {
      online: onlineDrivers,
      pendingKyc,
      pendingActivation: pendingActivationCount,
    },
    revenue: {
      grossLast30d: revenueLast30dAgg._sum.price ?? 0,
      commissionLast30d: commissionLast30dAgg._sum.platformFee ?? 0,
    },
    topDrivers,
    recentDeliveries,
    pendingActivationDrivers,
  };
}

// ---------- Users CRUD ----------

export async function listUsers(params: {
  role?: 'client' | 'driver' | 'merchant' | 'admin';
  search?: string;
  isActive?: boolean;
  take?: number;
  skip?: number;
}) {
  const where: Prisma.UserWhereInput = {};
  if (params.role) where.userType = params.role;
  if (params.isActive !== undefined) where.isActive = params.isActive;
  if (params.search) {
    where.OR = [
      { fullName: { contains: params.search, mode: 'insensitive' } },
      { phone: { contains: params.search } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.take ?? 50,
      skip: params.skip ?? 0,
      include: { driverProfile: true },
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total };
}

export async function getUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      driverProfile: true,
      _count: {
        select: {
          sentDeliveries: true,
          drivenDeliveries: true,
          receivedRatings: true,
        },
      },
    },
  });
  if (!user) throw new HttpError(404, 'NOT_FOUND', 'Utilisateur introuvable');

  const recentDeliveries = await prisma.delivery.findMany({
    where: {
      OR: [{ senderId: userId }, { driverId: userId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      sender: { select: { fullName: true } },
      driver: { select: { fullName: true } },
    },
  });

  return { user, recentDeliveries };
}

/**
 * Agrege les livraisons et CA par jour sur les N derniers jours.
 * Utilise pour le graphique d'evolution du dashboard.
 */
export async function getDailyStats(days = 30) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));

  const rows = await prisma.$queryRaw<
    { day: Date; delivered: bigint; cancelled: bigint; revenue: bigint | null }[]
  >`
    SELECT
      date_trunc('day', "createdAt") AS day,
      COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
      COUNT(*) FILTER (WHERE status IN ('cancelled', 'expired')) AS cancelled,
      SUM("price") FILTER (WHERE status = 'delivered') AS revenue
    FROM "Delivery"
    WHERE "createdAt" >= ${from}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const byDay = new Map<string, { delivered: number; cancelled: number; revenue: number }>();
  for (const r of rows) {
    const key = new Date(r.day).toISOString().slice(0, 10);
    byDay.set(key, {
      delivered: Number(r.delivered),
      cancelled: Number(r.cancelled),
      revenue: Number(r.revenue ?? 0),
    });
  }

  // Comble les jours manquants avec 0
  const result: Array<{ date: string; delivered: number; cancelled: number; revenue: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key);
    result.push({
      date: key,
      delivered: row?.delivered ?? 0,
      cancelled: row?.cancelled ?? 0,
      revenue: row?.revenue ?? 0,
    });
  }
  return result;
}

/**
 * Top zones de pickup (par volume). Regroupe les livraisons par carre geo
 * (arrondi a 0.01 degre = ~1km).
 */
export async function getHotZones(days = 30, limit = 5) {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const rows = await prisma.$queryRaw<
    { lat: number; lng: number; count: bigint }[]
  >`
    SELECT
      ROUND("pickupLat"::numeric, 2) AS lat,
      ROUND("pickupLng"::numeric, 2) AS lng,
      COUNT(*) AS count
    FROM "Delivery"
    WHERE "createdAt" >= ${from}
    GROUP BY 1, 2
    ORDER BY count DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lng),
    count: Number(r.count),
  }));
}

/**
 * Recupere l'historique GPS d'un livreur, ordre chronologique.
 * Utilise pour reconstituer son parcours (incident, litige).
 */
export async function getDriverLocationHistory(
  driverId: string,
  params: { from?: Date; to?: Date; limit?: number } = {},
) {
  const where: Prisma.DriverLocationLogWhereInput = { driverId };
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = params.from;
    if (params.to) where.createdAt.lte = params.to;
  }

  const user = await prisma.user.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  });
  if (!user) throw new HttpError(404, 'NOT_FOUND', 'Livreur introuvable');

  const logs = await prisma.driverLocationLog.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: params.limit ?? 1000,
    include: {
      delivery: {
        select: { id: true, reference: true, status: true },
      },
    },
  });

  // Compte par type d'evenement pour resume rapide
  const eventCounts: Record<string, number> = {};
  for (const l of logs) {
    eventCounts[l.event] = (eventCounts[l.event] ?? 0) + 1;
  }

  return {
    driver: user,
    range: {
      from: logs[0]?.createdAt ?? null,
      to: logs[logs.length - 1]?.createdAt ?? null,
    },
    eventCounts,
    total: logs.length,
    logs: logs.map((l) => ({
      id: l.id,
      latitude: l.latitude,
      longitude: l.longitude,
      event: l.event,
      deliveryId: l.deliveryId,
      deliveryReference: l.delivery?.reference ?? null,
      deliveryStatus: l.delivery?.status ?? null,
      createdAt: l.createdAt,
    })),
  };
}

// ---------- Wallet / transactions ----------

export async function listPendingPayouts(params: {
  type?: 'withdrawal' | 'topup';
  take?: number;
  skip?: number;
} = {}) {
  const where: Prisma.TransactionWhereInput = {
    status: 'pending',
  };
  if (params.type) where.type = params.type;

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.take ?? 50,
      skip: params.skip ?? 0,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            userType: true,
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);
  return { items, total };
}

export async function listAllTransactions(params: {
  userId?: string;
  type?: string;
  status?: string;
  take?: number;
  skip?: number;
} = {}) {
  const where: Prisma.TransactionWhereInput = {};
  if (params.userId) where.userId = params.userId;
  if (params.type) where.type = params.type as any;
  if (params.status) where.status = params.status as any;

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.take ?? 50,
      skip: params.skip ?? 0,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            userType: true,
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);
  return { items, total };
}

/**
 * Validation admin d'un topup (livreur a verse sa dette via Mobile Money).
 * Credit le walletBalance du livreur (reduit sa dette).
 */
export async function confirmTopup(args: {
  transactionId: string;
  adminId: string;
  note?: string;
}) {
  const tx = await prisma.transaction.findUnique({
    where: { id: args.transactionId },
  });
  if (!tx) throw new HttpError(404, 'NOT_FOUND', 'Transaction introuvable');
  if (tx.type !== 'topup') {
    throw new HttpError(400, 'INVALID_TYPE', 'Cette transaction n\'est pas un topup');
  }
  if (tx.status !== 'pending') {
    throw new HttpError(400, 'INVALID_STATE', 'Cette transaction est deja traitee');
  }

  return prisma.$transaction(async (trx) => {
    await trx.driverProfile.update({
      where: { userId: tx.userId },
      data: { walletBalance: { increment: tx.amount } },
    });
    return trx.transaction.update({
      where: { id: tx.id },
      data: {
        status: 'completed',
        processedBy: args.adminId,
        processedAt: new Date(),
        note: args.note ?? 'Paiement confirme',
      },
    });
  });
}

export async function rejectTopup(args: {
  transactionId: string;
  adminId: string;
  note?: string;
}) {
  return prisma.transaction.update({
    where: { id: args.transactionId },
    data: {
      status: 'failed',
      processedBy: args.adminId,
      processedAt: new Date(),
      note: args.note ?? 'Rejete par admin (paiement non recu)',
    },
  });
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
  reason?: string,
) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isActive,
      suspendedAt: isActive ? null : new Date(),
      suspendReason: isActive ? null : reason ?? null,
    },
  });

  // Push au livreur qui vient d'etre active (notification positive)
  if (isActive && updated.userType === 'driver') {
    const { sendPushToUser } = await import('./push.service.js');
    void sendPushToUser(
      userId,
      'Compte activé !',
      'Vous pouvez maintenant passer en ligne et recevoir des courses.',
      { type: 'account_activated' },
    ).catch(() => {});
  }

  return updated;
}

export async function resetUserOtp(userId: string) {
  // On vide les OTP codes existants pour ce user.
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'NOT_FOUND', 'Utilisateur introuvable');
  await prisma.otpCode.deleteMany({ where: { phone: user.phone } });
  // On invalide tous les refresh tokens (force le livreur/client a relogin)
  await prisma.refreshToken.deleteMany({ where: { userId } });
  return { ok: true };
}

export async function deleteUser(userId: string) {
  // Refuse si livraisons actives
  const activeCount = await prisma.delivery.count({
    where: {
      OR: [{ senderId: userId }, { driverId: userId }],
      status: {
        in: ['pending', 'accepted', 'picking_up', 'picked_up', 'delivering'],
      },
    },
  });
  if (activeCount > 0) {
    throw new HttpError(
      400,
      'ACTIVE_DELIVERIES',
      'Cet utilisateur a des livraisons actives. Terminez-les ou annulez-les d\'abord.',
    );
  }
  return prisma.user.delete({ where: { id: userId } });
}

// ---------- KYC verification ----------

export async function setDriverVerification(
  userId: string,
  status: 'verified' | 'rejected' | 'pending',
  note?: string,
) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
  });
  if (!profile)
    throw new HttpError(404, 'NOT_FOUND', 'Profil livreur introuvable');

  return prisma.driverProfile.update({
    where: { userId },
    data: {
      verificationStatus: status,
      verificationNote: note ?? null,
      verifiedAt: status === 'verified' ? new Date() : null,
    },
  });
}

// ---------- Deliveries ----------

export async function listDeliveries(params: {
  status?: string;
  search?: string;
  take?: number;
  skip?: number;
}) {
  const where: Prisma.DeliveryWhereInput = {};
  if (params.status) where.status = params.status as any;
  if (params.search) {
    where.OR = [
      { reference: { contains: params.search, mode: 'insensitive' } },
      { recipientName: { contains: params.search, mode: 'insensitive' } },
      { recipientPhone: { contains: params.search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.take ?? 50,
      skip: params.skip ?? 0,
      include: {
        sender: { select: { id: true, fullName: true, phone: true } },
        driver: { select: { id: true, fullName: true, phone: true } },
      },
    }),
    prisma.delivery.count({ where }),
  ]);

  return { items, total };
}

export async function getDeliveryDetail(deliveryId: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      sender: { select: { id: true, fullName: true, phone: true } },
      driver: { select: { id: true, fullName: true, phone: true } },
      ratings: true,
      transactions: true,
    },
  });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Livraison introuvable');
  return delivery;
}

export async function forceCancelDelivery(deliveryId: string, note?: string) {
  const d = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!d) throw new HttpError(404, 'NOT_FOUND', 'Livraison introuvable');
  if (['delivered', 'cancelled', 'expired'].includes(d.status)) {
    throw new HttpError(400, 'INVALID_STATE', 'Deja terminee');
  }
  return prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: 'other',
      cancelComment: note ?? 'Cancelled by admin',
    },
  });
}
