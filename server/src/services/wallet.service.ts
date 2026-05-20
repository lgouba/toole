import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/response.js';
import { logger } from '../lib/logger.js';
import { getAppSettings } from './settings.service.js';

/**
 * Portefeuille livreur.
 *
 * Modele : chaque livreur a un `walletBalance` sur DriverProfile qui represente
 * son solde net disponible = gains en wallet - retraits - dette commission.
 *
 * - Paiement wallet d'une livraison -> credit sur walletBalance (type: commission)
 * - Paiement cash d'une livraison -> meme credit wallet + debit equivalent de la
 *   commission plateforme (type: commission_debt). Net = 0 sur cash, mais on garde
 *   une trace pour calculer la dette cash totale.
 * - Retrait -> debit walletBalance quand la demande est creee (statut pending),
 *   remboursement si admin rejette la demande.
 *
 * La "dette commission" separee = somme(commission_debt) - elle indique combien
 * le livreur doit rembourser a la plateforme s'il fait beaucoup de courses cash.
 */

/**
 * Recupere le solde wallet + la dette d'un livreur.
 *
 * La dette est deduite directement du walletBalance (source unique de verite) :
 *   - walletBalance > 0 -> solde disponible pour retrait, dette = 0
 *   - walletBalance < 0 -> dette = -walletBalance, balance = 0
 *
 * Chaque operation (commission_debt, topup, withdrawal, adjustment) a deja
 * modifie walletBalance au moment de sa validation, donc on s'appuie dessus.
 */
export async function getWalletSnapshot(userId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { walletBalance: true, totalDeliveries: true },
  });
  if (!profile) throw new HttpError(404, 'NOT_FOUND', 'Driver profile not found');

  const raw = profile.walletBalance;
  const commissionDebt = Math.max(0, -raw);

  // Somme des topups en attente de validation (deja initie un reglement
  // par le livreur, attend la confirmation admin pour debiter la dette).
  // On l'utilise pour eviter qu'un livreur fasse plusieurs reglements pour
  // le meme montant en attendant que l'admin valide.
  const pendingAgg = await prisma.transaction.aggregate({
    where: { userId, type: 'topup', status: 'pending' },
    _sum: { amount: true },
  });
  const pendingTopupAmount = pendingAgg._sum.amount ?? 0;

  // Dette nette = ce que le livreur peut encore reverser MAINTENANT
  // (commission encore due moins les reglements en attente de validation).
  const effectiveDebt = Math.max(0, commissionDebt - pendingTopupAmount);

  // Cumul a vie des gains livreur : somme de toutes les transactions de
  // type "commission" completees (les credits gagnes a chaque livraison
  // terminee, cash ou wallet confondus). C'est l'onglet "Mes gains".
  const earnedAgg = await prisma.transaction.aggregate({
    where: { userId, type: 'commission', status: 'completed' },
    _sum: { amount: true },
  });
  const totalEarned = earnedAgg._sum.amount ?? 0;

  return {
    balance: Math.max(0, raw),
    commissionDebt,
    pendingTopupAmount,
    effectiveDebt,
    totalDeliveries: profile.totalDeliveries,
    totalEarned,
  };
}

/** Liste les transactions d'un utilisateur, plus recente en premier */
export async function listUserTransactions(
  userId: string,
  opts: { limit?: number; skip?: number } = {},
) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 50,
    skip: opts.skip ?? 0,
    include: {
      delivery: {
        select: { reference: true, status: true },
      },
    },
  });
}

/** Demande de retrait par un livreur. Debit immediat du walletBalance. */
export async function requestWithdrawal(args: {
  userId: string;
  amount: number;
  phoneNumber: string; // format 226XXXXXXXX
  paymentMethod: 'orange_money' | 'moov_money';
}) {
  if (args.amount <= 0) {
    throw new HttpError(400, 'INVALID_AMOUNT', 'Montant invalide');
  }

  const settings = await getAppSettings();
  if (args.amount < settings.minWithdrawAmount) {
    throw new HttpError(
      400,
      'AMOUNT_TOO_LOW',
      `Le montant minimum de retrait est de ${settings.minWithdrawAmount} ${settings.currency}.`,
    );
  }

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: args.userId },
    select: { walletBalance: true },
  });
  if (!profile) throw new HttpError(404, 'NOT_FOUND', 'Profil livreur introuvable');
  if (profile.walletBalance < args.amount) {
    throw new HttpError(400, 'INSUFFICIENT_FUNDS', 'Solde insuffisant');
  }

  // Transaction atomique : debit wallet + creation transaction 'pending'
  const tx = await prisma.$transaction(async (trx) => {
    await trx.driverProfile.update({
      where: { userId: args.userId },
      data: { walletBalance: { decrement: args.amount } },
    });
    return trx.transaction.create({
      data: {
        userId: args.userId,
        type: 'withdrawal',
        amount: -args.amount,
        paymentMethod: args.paymentMethod,
        phoneNumber: args.phoneNumber,
        status: 'pending',
      },
    });
  });

  logger.info(
    { userId: args.userId, amount: args.amount, txId: tx.id },
    'Withdrawal requested',
  );
  return tx;
}

/**
 * Admin marque un retrait comme paye ("completed").
 * Ou admin rejette -> rembourse le solde et passe la transaction en "failed".
 */
export async function processWithdrawal(args: {
  transactionId: string;
  adminId: string;
  decision: 'complete' | 'reject';
  note?: string;
}) {
  const tx = await prisma.transaction.findUnique({
    where: { id: args.transactionId },
  });
  if (!tx) throw new HttpError(404, 'NOT_FOUND', 'Transaction introuvable');
  if (tx.type !== 'withdrawal') {
    throw new HttpError(400, 'INVALID_TYPE', 'Cette transaction n\'est pas un retrait');
  }
  if (tx.status !== 'pending') {
    throw new HttpError(400, 'INVALID_STATE', 'Cette transaction est deja traitee');
  }

  if (args.decision === 'complete') {
    return prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: 'completed',
        processedBy: args.adminId,
        processedAt: new Date(),
        note: args.note ?? null,
      },
    });
  }

  // reject -> rembourser le solde et marquer failed
  return prisma.$transaction(async (trx) => {
    await trx.driverProfile.update({
      where: { userId: tx.userId },
      data: { walletBalance: { increment: Math.abs(tx.amount) } },
    });
    return trx.transaction.update({
      where: { id: tx.id },
      data: {
        status: 'failed',
        processedBy: args.adminId,
        processedAt: new Date(),
        note: args.note ?? 'Rejete par admin',
      },
    });
  });
}

/**
 * Ajustement manuel admin : credit ou debit du wallet.
 * Utile pour regulariser la dette commission cash d'un livreur qui a paye
 * la plateforme hors app, ou corriger une erreur.
 */
export async function adminAdjustWallet(args: {
  driverUserId: string;
  amount: number; // positif = credit, negatif = debit
  adminId: string;
  note: string;
}) {
  if (args.amount === 0) {
    throw new HttpError(400, 'INVALID_AMOUNT', 'Montant nul');
  }

  return prisma.$transaction(async (trx) => {
    const profile = await trx.driverProfile.findUnique({
      where: { userId: args.driverUserId },
    });
    if (!profile) throw new HttpError(404, 'NOT_FOUND', 'Profil livreur introuvable');
    if (args.amount < 0 && profile.walletBalance + args.amount < 0) {
      throw new HttpError(400, 'INSUFFICIENT_FUNDS', 'Solde insuffisant');
    }
    await trx.driverProfile.update({
      where: { userId: args.driverUserId },
      data: { walletBalance: { increment: args.amount } },
    });
    return trx.transaction.create({
      data: {
        userId: args.driverUserId,
        type: 'adjustment',
        amount: args.amount,
        paymentMethod: 'wallet',
        status: 'completed',
        processedBy: args.adminId,
        processedAt: new Date(),
        note: args.note,
      },
    });
  });
}
