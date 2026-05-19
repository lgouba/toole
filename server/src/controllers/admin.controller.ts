import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthedRequest } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import * as adminService from '../services/admin.service.js';
import { prisma } from '../lib/prisma.js';
import { broadcastPush, type BroadcastTarget } from '../services/push.service.js';
import { logger } from '../lib/logger.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function adminLoginCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await adminService.adminLogin(email, password);
    return success(res, {
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        userType: result.user.userType,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMeAdminCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    return success(res, {
      id: req.user!.id,
      email: req.user!.email,
      fullName: req.user!.fullName,
      userType: req.user!.userType,
    });
  } catch (err) {
    next(err);
  }
}

export async function statsCtrl(
  _req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const stats = await adminService.getDashboardStats();
    return success(res, stats);
  } catch (err) {
    next(err);
  }
}

// ---------- Users ----------

const listUsersSchema = z.object({
  role: z.enum(['client', 'driver', 'merchant', 'admin']).optional(),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  take: z.coerce.number().min(1).max(200).default(50),
  skip: z.coerce.number().min(0).default(0),
});

export async function listUsersCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = listUsersSchema.parse(req.query);
    const result = await adminService.listUsers({
      role: q.role,
      search: q.search,
      isActive:
        q.isActive === 'true' ? true : q.isActive === 'false' ? false : undefined,
      take: q.take,
      skip: q.skip,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getUserCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await adminService.getUserDetail(req.params.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

const suspendSchema = z.object({ reason: z.string().max(500).optional() });

export async function suspendUserCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { reason } = suspendSchema.parse(req.body ?? {});
    const user = await adminService.setUserActive(req.params.id, false, reason);
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function reactivateUserCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await adminService.setUserActive(req.params.id, true);
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function resetOtpCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await adminService.resetUserOtp(req.params.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function deleteUserCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await adminService.deleteUser(req.params.id);
    return success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

// ---------- Dashboard charts ----------

export async function getDailyStatsCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const days = Math.min(90, Math.max(7, parseInt(String(req.query.days ?? '30'), 10)));
    const result = await adminService.getDailyStats(days);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getHotZonesCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const days = Math.min(90, Math.max(1, parseInt(String(req.query.days ?? '30'), 10)));
    const result = await adminService.getHotZones(days, 10);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// ---------- App settings ----------

import * as settingsService from '../services/settings.service.js';

const settingsUpdateSchema = z.object({
  appName: z.string().trim().min(1).max(50).optional(),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  currency: z.string().trim().min(1).max(10).optional(),
  currencyLocale: z.string().trim().min(2).max(20).optional(),
  basePriceEnvelope: z.number().int().min(0).optional(),
  basePriceSmall: z.number().int().min(0).optional(),
  basePriceMedium: z.number().int().min(0).optional(),
  basePriceLarge: z.number().int().min(0).optional(),
  pricePerKm: z.number().int().min(0).optional(),
  platformCommissionPct: z.number().int().min(0).max(100).optional(),
  confettiEnabled: z.boolean().optional(),
  driverSoundEnabled: z.boolean().optional(),
  driverVibrationEnabled: z.boolean().optional(),
  nightSurchargeEnabled: z.boolean().optional(),
  nightSurchargeStartHour: z.number().int().min(0).max(23).optional(),
  nightSurchargeEndHour: z.number().int().min(0).max(23).optional(),
  nightSurchargeAmount: z.number().int().min(0).max(100000).optional(),
  rainSurchargePct: z.number().int().min(0).max(500).optional(),
  deliveryExpiryMinutes: z.number().int().min(1).max(60).optional(),
  driverCancelCooldownSeconds: z.number().int().min(0).max(1800).optional(),
  nearbyRadiusKm: z.number().int().min(1).max(50).optional(),
  // Chainage de courses (style Uber) : 0 = desactive, sinon ETA max en minutes
  // jusqu'a la fin de la course actuelle pour proposer la suivante en banniere.
  chainingMaxRemainingMinutes: z.number().int().min(0).max(15).optional(),
  driverHeartbeatMaxAgeSeconds: z.number().int().min(30).max(600).optional(),
  minWithdrawAmount: z.number().int().min(0).max(1000000).optional(),
  commissionDebtLimit: z.number().int().min(0).max(10000000).optional(),
  scheduledMinDelayMinutes: z.number().int().min(1).max(120).optional(),
  minSupportedAppVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Format semver requis : "1.0.0"')
    .optional(),
  forceUpdateMessage: z.string().max(500).nullable().optional(),
});

export async function getSettingsCtrl(
  _req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const settings = await settingsService.getAppSettings();
    return success(res, settings);
  } catch (err) {
    next(err);
  }
}

export async function updateSettingsCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = settingsUpdateSchema.parse(req.body);
    const settings = await settingsService.updateAppSettings(body, req.user!.id);
    return success(res, settings);
  } catch (err) {
    next(err);
  }
}

// ---------- Wallet / Transactions ----------

import * as walletService from '../services/wallet.service.js';

const listTxSchema = z.object({
  userId: z.string().uuid().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  take: z.coerce.number().min(1).max(200).optional(),
  skip: z.coerce.number().min(0).optional(),
});

export async function listTransactionsCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = listTxSchema.parse(req.query);
    const result = await adminService.listAllTransactions(q);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listPendingPayoutsCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const type = (req.query.type === 'topup' || req.query.type === 'withdrawal')
      ? (req.query.type as 'topup' | 'withdrawal')
      : undefined;
    const result = await adminService.listPendingPayouts({ type });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

const decisionSchema = z.object({
  note: z.string().max(500).optional(),
});

export async function markWithdrawalPaidCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = decisionSchema.parse(req.body ?? {});
    const tx = await walletService.processWithdrawal({
      transactionId: req.params.id,
      adminId: req.user!.id,
      decision: 'complete',
      note: body.note,
    });
    return success(res, tx);
  } catch (err) {
    next(err);
  }
}

export async function rejectWithdrawalCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = decisionSchema.parse(req.body ?? {});
    const tx = await walletService.processWithdrawal({
      transactionId: req.params.id,
      adminId: req.user!.id,
      decision: 'reject',
      note: body.note,
    });
    return success(res, tx);
  } catch (err) {
    next(err);
  }
}

export async function confirmTopupCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = decisionSchema.parse(req.body ?? {});
    const tx = await adminService.confirmTopup({
      transactionId: req.params.id,
      adminId: req.user!.id,
      note: body.note,
    });
    return success(res, tx);
  } catch (err) {
    next(err);
  }
}

export async function rejectTopupCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = decisionSchema.parse(req.body ?? {});
    const tx = await adminService.rejectTopup({
      transactionId: req.params.id,
      adminId: req.user!.id,
      note: body.note,
    });
    return success(res, tx);
  } catch (err) {
    next(err);
  }
}

const adjustSchema = z.object({
  amount: z.number().int(),
  note: z.string().min(1).max(500),
});

export async function adjustWalletCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = adjustSchema.parse(req.body);
    const tx = await walletService.adminAdjustWallet({
      driverUserId: req.params.id,
      adminId: req.user!.id,
      amount: body.amount,
      note: body.note,
    });
    return success(res, tx);
  } catch (err) {
    next(err);
  }
}

// ---------- Location history ----------

const locationHistorySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().min(1).max(5000).optional(),
});

export async function getDriverLocationHistoryCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = locationHistorySchema.parse(req.query);
    const result = await adminService.getDriverLocationHistory(req.params.id, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      limit: q.limit,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// ---------- KYC ----------

const verifySchema = z.object({
  status: z.enum(['verified', 'rejected', 'pending']),
  note: z.string().max(500).optional(),
});

export async function verifyDriverCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = verifySchema.parse(req.body);
    const profile = await adminService.setDriverVerification(
      req.params.id,
      body.status,
      body.note,
    );
    return success(res, profile);
  } catch (err) {
    next(err);
  }
}

// ---------- Deliveries ----------

const listDeliveriesSchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  take: z.coerce.number().min(1).max(200).default(50),
  skip: z.coerce.number().min(0).default(0),
});

export async function listDeliveriesAdminCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = listDeliveriesSchema.parse(req.query);
    const result = await adminService.listDeliveries(q);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getDeliveryAdminCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const delivery = await adminService.getDeliveryDetail(req.params.id);
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}

const forceCancelSchema = z.object({ note: z.string().max(500).optional() });

export async function forceCancelDeliveryCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = forceCancelSchema.parse(req.body ?? {});
    const delivery = await adminService.forceCancelDelivery(
      req.params.id,
      body.note,
    );
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}

// ============================================================
// Notifications push (broadcast)
// ============================================================

const broadcastSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(300),
  target: z.enum(['all', 'clients', 'drivers']),
});

/**
 * POST /api/admin/notifications/broadcast
 * Envoie une notification push a tous les users selon la cible.
 * Enregistre la campagne en DB pour historique + audit.
 */
export async function broadcastNotificationCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = broadcastSchema.parse(req.body);
    const result = await broadcastPush({
      title: body.title,
      body: body.body,
      target: body.target as BroadcastTarget,
    });

    const campaign = await prisma.pushCampaign.create({
      data: {
        title: body.title,
        body: body.body,
        target: body.target,
        sentCount: result.sent,
        failedCount: result.failed,
        createdBy: req.user?.id ?? null,
      },
    });

    logger.info(
      {
        campaignId: campaign.id,
        target: body.target,
        sent: result.sent,
        failed: result.failed,
      },
      'Push campaign sent by admin',
    );

    return success(res, { ...campaign, tokenCount: result.tokenCount });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/notifications
 * Liste les campagnes envoyees (historique).
 */
export async function listNotificationsCtrl(
  _req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const campaigns = await prisma.pushCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return success(res, campaigns);
  } catch (err) {
    next(err);
  }
}
