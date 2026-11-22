import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AuthedRequest } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import {
  registerPushToken,
  unregisterPushToken,
} from '../services/push.service.js';

export async function getMe(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { driverProfile: true },
    });
    if (!user) return success(res, null);
    // Ne jamais renvoyer le hash du mot de passe (secret dérivé), même à soi-même.
    const { passwordHash, ...safe } = user;
    void passwordHash;
    return success(res, safe);
  } catch (err) {
    next(err);
  }
}

const updateMeSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().nullable(),
  // L'app stocke les uploads en chemin RELATIF (/uploads/...) ; on accepte ce
  // format ET une URL absolue (compat). `.url()` seul rejetait le chemin relatif
  // envoye par le mobile -> "Request validation failed" a l'enregistrement.
  avatarUrl: z
    .string()
    .max(500)
    .refine((v) => v.startsWith('/uploads/') || /^https?:\/\//.test(v), {
      message: 'avatarUrl doit être un chemin /uploads/… ou une URL http(s)',
    })
    .optional()
    .nullable(),
});

export async function updateMe(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = updateMeSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      include: { driverProfile: true },
    });
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function deleteMe(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const active = await prisma.delivery.count({
      where: {
        OR: [{ senderId: req.user!.id }, { driverId: req.user!.id }],
        status: {
          in: ['pending', 'accepted', 'picking_up', 'picked_up', 'delivering'],
        },
      },
    });
    if (active > 0) {
      return res.status(400).json({
        data: null,
        error: {
          code: 'ACTIVE_DELIVERIES',
          message:
            'Vous avez des livraisons en cours. Terminez-les ou annulez-les avant de supprimer votre compte.',
        },
      });
    }
    await prisma.user.delete({ where: { id: req.user!.id } });
    return success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

// Préférences de notifications par catégorie. Clés courtes côté API, mappées
// vers les colonnes User.
const preferencesSchema = z.object({
  newDeliveries: z.boolean().optional(),
  deliveryUpdates: z.boolean().optional(),
  promotions: z.boolean().optional(),
});

export async function updatePreferences(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const p = preferencesSchema.parse(req.body);
    const data: Record<string, unknown> = {};
    if (p.newDeliveries !== undefined) data.notifNewDeliveries = p.newDeliveries;
    if (p.deliveryUpdates !== undefined) data.notifDeliveryUpdates = p.deliveryUpdates;
    if (p.promotions !== undefined) data.notifPromotions = p.promotions;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: {
        notifNewDeliveries: true,
        notifDeliveryUpdates: true,
        notifPromotions: true,
      },
    });
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

const pushTokenSchema = z.object({
  token: z.string().min(10).max(500),
  platform: z.string().max(20).optional(),
});

export async function registerPushTokenCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { token, platform } = pushTokenSchema.parse(req.body);
    await registerPushToken(req.user!.id, token, platform);
    return success(res, { registered: true });
  } catch (err) {
    next(err);
  }
}

export async function unregisterPushTokenCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { token } = pushTokenSchema.pick({ token: true }).parse(req.body);
    await unregisterPushToken(req.user!.id, token);
    return success(res, { unregistered: true });
  } catch (err) {
    next(err);
  }
}
