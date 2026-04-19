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
    },
    revenue: {
      grossLast30d: revenueLast30dAgg._sum.price ?? 0,
      commissionLast30d: commissionLast30dAgg._sum.platformFee ?? 0,
    },
    topDrivers,
    recentDeliveries,
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

export async function setUserActive(
  userId: string,
  isActive: boolean,
  reason?: string,
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      isActive,
      suspendedAt: isActive ? null : new Date(),
      suspendReason: isActive ? null : reason ?? null,
    },
  });
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
