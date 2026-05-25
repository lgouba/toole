import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthedRequest } from '../middleware/auth.js';
import { success, HttpError } from '../utils/response.js';
import * as walletService from '../services/wallet.service.js';
import { sendOtp as sendAuthOtp, verifyOtpCode } from '../services/auth.service.js';
import { prisma } from '../lib/prisma.js';
import { getAppSettings } from '../services/settings.service.js';
import { logger } from '../lib/logger.js';
import { emitToAdmins } from '../services/notification.service.js';

/** Format local 8 chiffres "XX XX XX XX" ou +226XXXXXXXX */
const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, '')) // retire les espaces
  .refine((v) => /^\+?2?2?6?[0-9]{8}$/.test(v) || /^[0-9]{8}$/.test(v), {
    message: 'Format de telephone invalide (8 chiffres requis)',
  })
  .transform((v) => {
    const digits = v.replace(/\D/g, '');
    if (digits.length === 8) return `226${digits}`;
    return digits;
  });

// -------- Lecture --------

export async function getMyWalletCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const snapshot = await walletService.getWalletSnapshot(req.user!.id);
    return success(res, snapshot);
  } catch (err) {
    next(err);
  }
}

export async function getMyTransactionsCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)),
    );
    const skip = Math.max(0, parseInt(String(req.query.skip ?? '0'), 10));
    const txs = await walletService.listUserTransactions(req.user!.id, {
      limit,
      skip,
    });
    return success(res, txs);
  } catch (err) {
    next(err);
  }
}

// -------- Retrait (gains wallet) --------

const withdrawOtpSchema = z.object({ phone: phoneSchema });
const withdrawSchema = z.object({
  amount: z.number().int().positive(),
  phone: phoneSchema,
  paymentMethod: z.enum(['orange_money', 'moov_money']),
  otpCode: z.string().length(4),
});

export async function sendWithdrawOtpCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { phone } = withdrawOtpSchema.parse(req.body);
    await sendAuthOtp(phone); // reutilise la meme infra OTP (Africa's Talking ou dev=1234)
    return success(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function requestWithdrawCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = withdrawSchema.parse(req.body);
    await verifyOtpCode(body.phone, body.otpCode);
    const tx = await walletService.requestWithdrawal({
      userId: req.user!.id,
      amount: body.amount,
      phoneNumber: body.phone,
      paymentMethod: body.paymentMethod,
    });
    return success(res, tx);
  } catch (err) {
    next(err);
  }
}

// -------- Topup (reglement de dette) --------

const topupOtpSchema = z.object({ phone: phoneSchema });
const topupSchema = z.object({
  amount: z.number().int().positive(),
  phone: phoneSchema,
  paymentMethod: z.enum(['orange_money', 'moov_money']),
  otpCode: z.string().length(4),
});

export async function sendTopupOtpCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { phone } = topupOtpSchema.parse(req.body);
    await sendAuthOtp(phone);
    return success(res, { success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Le livreur regle sa dette en envoyant de l'argent Mobile Money a la plateforme.
 * Pour l'instant : genere une transaction 'topup' en status 'pending'. Un admin
 * confirmera la reception du paiement (ou, plus tard, webhook Orange Money auto).
 * Le credit sur walletBalance se fait a la validation par l'admin.
 */
export async function requestTopupCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = topupSchema.parse(req.body);
    await verifyOtpCode(body.phone, body.otpCode);

    // Verifie que le user est un livreur
    const profile = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!profile) {
      throw new HttpError(403, 'NOT_DRIVER', 'Seuls les livreurs peuvent regler leur dette');
    }

    // Empeche le double-paiement : on bloque si la somme {nouveau topup + pending}
    // depasse la dette commission reelle. Le livreur doit attendre la validation
    // de ses paiements precedents avant d'en faire de nouveaux.
    await assertTopupWithinEffectiveDebt(req.user!.id, body.amount);

    const tx = await prisma.transaction.create({
      data: {
        userId: req.user!.id,
        type: 'topup',
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        phoneNumber: body.phone,
        status: 'pending',
        note: 'Reglement de dette livreur en attente de validation admin',
      },
    });

    logger.info(
      { userId: req.user!.id, amount: body.amount, txId: tx.id },
      'Topup requested',
    );

    // Notif admin (socket) pour validation rapide.
    emitToAdmins('admin:topup_requested', {
      transactionId: tx.id,
      driverId: req.user!.id,
      driverName: req.user!.fullName ?? 'Livreur',
      driverPhone: req.user!.phone ?? null,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      phoneNumber: body.phone,
      requestedAt: tx.createdAt.toISOString(),
    });

    return success(res, tx);
  } catch (err) {
    next(err);
  }
}

/**
 * Verifie que (somme topup pending + nouveau montant) ne depasse pas la dette
 * commission reelle du livreur. Sinon on refuse (un autre paiement est deja
 * en attente, le livreur doit patienter).
 */
async function assertTopupWithinEffectiveDebt(userId: string, amount: number) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { walletBalance: true },
  });
  const commissionDebt = Math.max(0, -(profile?.walletBalance ?? 0));
  const pendingAgg = await prisma.transaction.aggregate({
    where: { userId, type: 'topup', status: 'pending' },
    _sum: { amount: true },
  });
  const pendingTopupAmount = pendingAgg._sum.amount ?? 0;
  const effectiveDebt = Math.max(0, commissionDebt - pendingTopupAmount);

  if (commissionDebt === 0) {
    throw new HttpError(
      400,
      'NO_DEBT',
      "Vous n'avez aucune commission a reverser.",
    );
  }
  if (amount > effectiveDebt) {
    throw new HttpError(
      400,
      'PENDING_TOPUPS_EXCEED',
      `Vous avez deja ${pendingTopupAmount} FCFA en attente de validation. ` +
        `Vous pouvez encore reverser au maximum ${effectiveDebt} FCFA.`,
    );
  }
}

// -------- Topup en espèce --------
// Le livreur prefere remettre son cash en main propre a l'admin plutot que
// passer par Mobile Money. On cree juste une transaction 'topup' en status
// 'pending' avec paymentMethod='cash' + un token court servant de preuve a
// montrer a l'admin. L'admin valide manuellement = encaissement OK.

const cashTopupSchema = z.object({
  amount: z.number().int().positive(),
});

export async function requestCashTopupCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = cashTopupSchema.parse(req.body);

    const profile = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!profile) {
      throw new HttpError(403, 'NOT_DRIVER', 'Seuls les livreurs peuvent regler leur dette');
    }

    // Verifie pas de double-paiement (cf. requestTopupCtrl)
    await assertTopupWithinEffectiveDebt(req.user!.id, body.amount);

    // Code court (4 chiffres) que le livreur presentera a l'admin pour valider
    const confirmCode = Math.floor(1000 + Math.random() * 9000).toString();

    const tx = await prisma.transaction.create({
      data: {
        userId: req.user!.id,
        type: 'topup',
        amount: body.amount,
        paymentMethod: 'cash',
        status: 'pending',
        note: `Reglement cash - code: ${confirmCode}`,
      },
    });

    logger.info(
      {
        userId: req.user!.id,
        amount: body.amount,
        txId: tx.id,
        confirmCode,
      },
      'Cash topup requested',
    );
    return success(res, { ...tx, confirmCode });
  } catch (err) {
    next(err);
  }
}
