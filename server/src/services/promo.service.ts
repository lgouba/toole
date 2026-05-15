import { Prisma, PromoDiscountType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/response.js';
import { logger } from '../lib/logger.js';

export interface PromoValidationResult {
  /** Code applique (en majuscules). */
  code: string;
  /** Type de remise. */
  discountType: PromoDiscountType;
  /** Valeur brute du code (% ou FCFA). */
  discountValue: number;
  /** Remise effectivement appliquee au prix donne (FCFA, valeur positive). */
  discountAmount: number;
  /** Description interne (peut etre exposee au client si tu veux). */
  description: string | null;
}

/**
 * Calcule le montant de remise pour un code donne sur un prix donne.
 * NE valide PAS le code (utiliser validatePromoCode pour ca).
 */
function computeDiscount(
  discountType: PromoDiscountType,
  discountValue: number,
  basePrice: number,
): number {
  if (discountType === 'percentage') {
    // Clamp 1-100 (deja valide en DB)
    return Math.round((basePrice * discountValue) / 100);
  }
  // fixed : la remise ne peut pas exceder le prix
  return Math.min(discountValue, basePrice);
}

/**
 * Valide un code promo pour un utilisateur sur un montant de commande donne.
 * Retourne le montant de remise applicable. Si invalide, throw HttpError 400.
 *
 * Cette fonction est appelee a 2 endroits :
 *   - POST /promo/validate : le client veut savoir avant submit s'il a une remise
 *   - createDelivery       : application finale au moment du submit (re-check
 *                            pour eviter qu'un code expire entre temps)
 */
export async function validatePromoCode(
  rawCode: string,
  userId: string,
  orderAmount: number,
): Promise<PromoValidationResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    throw new HttpError(400, 'INVALID_PROMO_CODE', 'Code promo invalide');
  }

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) {
    throw new HttpError(400, 'PROMO_NOT_FOUND', 'Ce code promo n\'existe pas');
  }
  if (!promo.isActive) {
    throw new HttpError(400, 'PROMO_INACTIVE', 'Ce code promo est désactivé');
  }
  const now = new Date();
  if (promo.validFrom > now) {
    throw new HttpError(
      400,
      'PROMO_NOT_YET_VALID',
      "Ce code n'est pas encore actif",
    );
  }
  if (promo.validTo && promo.validTo < now) {
    throw new HttpError(400, 'PROMO_EXPIRED', 'Ce code promo a expiré');
  }
  if (promo.maxUses && promo.currentUses >= promo.maxUses) {
    throw new HttpError(
      400,
      'PROMO_QUOTA_EXHAUSTED',
      'Ce code a atteint son quota d\'utilisations',
    );
  }
  if (promo.minOrderAmount && orderAmount < promo.minOrderAmount) {
    throw new HttpError(
      400,
      'PROMO_MIN_ORDER',
      `Ce code requiert une commande minimum de ${promo.minOrderAmount} FCFA`,
    );
  }

  // Verif usage per-user
  if (promo.maxUsesPerUser) {
    const userUsages = await prisma.promoCodeUsage.count({
      where: { promoCodeId: promo.id, userId },
    });
    if (userUsages >= promo.maxUsesPerUser) {
      throw new HttpError(
        400,
        'PROMO_USER_LIMIT',
        'Vous avez deja utilise ce code le nombre maximum de fois autorise',
      );
    }
  }

  const discountAmount = computeDiscount(
    promo.discountType,
    promo.discountValue,
    orderAmount,
  );

  return {
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    discountAmount,
    description: promo.description,
  };
}

/**
 * Marque le code comme utilise par un user pour une livraison.
 * Atomique : increment currentUses + creation usage en transaction.
 */
export async function consumePromoCode(args: {
  code: string;
  userId: string;
  deliveryId: string;
  discountAmount: number;
}): Promise<void> {
  const code = args.code.trim().toUpperCase();
  try {
    await prisma.$transaction(async (tx) => {
      const promo = await tx.promoCode.findUnique({ where: { code } });
      if (!promo) throw new HttpError(400, 'PROMO_NOT_FOUND', 'Code introuvable');
      await tx.promoCode.update({
        where: { id: promo.id },
        data: { currentUses: { increment: 1 } },
      });
      await tx.promoCodeUsage.create({
        data: {
          promoCodeId: promo.id,
          userId: args.userId,
          deliveryId: args.deliveryId,
          discountAmount: args.discountAmount,
        },
      });
    });
    logger.info(
      { code, userId: args.userId, deliveryId: args.deliveryId, discountAmount: args.discountAmount },
      'Promo code consumed',
    );
  } catch (err) {
    logger.warn({ err, code, userId: args.userId }, 'consumePromoCode failed');
    throw err;
  }
}

// ============================================================
// Admin CRUD
// ============================================================

export async function listPromoCodes() {
  return prisma.promoCode.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    include: { _count: { select: { usages: true } } },
  });
}

export interface CreatePromoCodeInput {
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxUses?: number;
  maxUsesPerUser?: number;
  validFrom?: Date;
  validTo?: Date;
  isActive?: boolean;
  description?: string;
  createdBy?: string;
}

export async function createPromoCode(input: CreatePromoCodeInput) {
  const code = input.code.trim().toUpperCase();
  if (code.length < 3 || code.length > 30) {
    throw new HttpError(
      400,
      'INVALID_CODE',
      'Le code doit faire entre 3 et 30 caractères',
    );
  }
  if (input.discountType === 'percentage') {
    if (input.discountValue < 1 || input.discountValue > 100) {
      throw new HttpError(
        400,
        'INVALID_DISCOUNT',
        'Le pourcentage doit etre entre 1 et 100',
      );
    }
  } else if (input.discountValue < 1) {
    throw new HttpError(400, 'INVALID_DISCOUNT', 'La remise doit etre positive');
  }

  try {
    return await prisma.promoCode.create({
      data: {
        code,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minOrderAmount: input.minOrderAmount ?? null,
        maxUses: input.maxUses ?? null,
        maxUsesPerUser: input.maxUsesPerUser ?? null,
        validFrom: input.validFrom ?? new Date(),
        validTo: input.validTo ?? null,
        isActive: input.isActive ?? true,
        description: input.description ?? null,
        createdBy: input.createdBy ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(
        409,
        'CODE_EXISTS',
        'Un code promo avec ce nom existe deja',
      );
    }
    throw err;
  }
}

export async function updatePromoCode(
  id: string,
  patch: Partial<CreatePromoCodeInput>,
) {
  const data: Prisma.PromoCodeUpdateInput = {};
  if (patch.code !== undefined) data.code = patch.code.trim().toUpperCase();
  if (patch.discountType !== undefined) data.discountType = patch.discountType;
  if (patch.discountValue !== undefined) data.discountValue = patch.discountValue;
  if (patch.minOrderAmount !== undefined)
    data.minOrderAmount = patch.minOrderAmount;
  if (patch.maxUses !== undefined) data.maxUses = patch.maxUses;
  if (patch.maxUsesPerUser !== undefined) data.maxUsesPerUser = patch.maxUsesPerUser;
  if (patch.validFrom !== undefined) data.validFrom = patch.validFrom;
  if (patch.validTo !== undefined) data.validTo = patch.validTo;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  if (patch.description !== undefined) data.description = patch.description;

  try {
    return await prisma.promoCode.update({ where: { id }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'CODE_EXISTS', 'Un code avec ce nom existe deja');
    }
    throw err;
  }
}

export async function deletePromoCode(id: string) {
  await prisma.promoCode.delete({ where: { id } });
}
