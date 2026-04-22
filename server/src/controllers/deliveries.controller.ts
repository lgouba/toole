import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AuthedRequest } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import {
  createDelivery,
  listDeliveries,
  getDeliveryForUser,
  acceptDelivery,
  rejectDelivery,
  confirmPickup,
  validateCode,
  cancelDelivery,
  relaunchDelivery,
  rateDelivery,
  estimatePrice,
} from '../services/delivery.service.js';

const createDeliverySchema = z.object({
  packageType: z.enum(['envelope', 'small', 'large']),
  packageDescription: z.string().max(500).optional(),
  recipientName: z.string().min(1).max(100),
  recipientPhone: z.string().regex(/^\+?[0-9]{8,15}$/),
  pickupAddress: z.string().min(1),
  pickupDetails: z.string().optional(),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  deliveryAddress: z.string().min(1),
  deliveryDetails: z.string().optional(),
  deliveryLat: z.number().min(-90).max(90),
  deliveryLng: z.number().min(-180).max(180),
  scheduledFor: z.string().datetime().optional(),
});

export async function createDeliveryCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = createDeliverySchema.parse(req.body);
    const delivery = await createDelivery({
      ...body,
      senderId: req.user!.id,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
    });
    return success(res, delivery, 201);
  } catch (err) {
    next(err);
  }
}

const listSchema = z.object({
  status: z
    .enum([
      'scheduled',
      'pending',
      'accepted',
      'picking_up',
      'picked_up',
      'delivering',
      'delivered',
      'cancelled',
      'expired',
    ])
    .optional(),
  role: z.enum(['sender', 'driver']).default('sender'),
});

export async function listDeliveriesCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { status, role } = listSchema.parse(req.query);
    const results = await listDeliveries({
      userId: req.user!.id,
      role,
      status,
    });
    return success(res, results);
  } catch (err) {
    next(err);
  }
}

export async function getDeliveryCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const delivery = await getDeliveryForUser(req.params.id, req.user!.id);
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}

export async function acceptCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const delivery = await acceptDelivery(req.params.id, req.user!.id);
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}

export async function rejectCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await rejectDelivery(req.params.id, req.user!.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// Accepte soit une URL absolue (https://...) soit un chemin relatif (/uploads/...)
// que l'app peut generer via /api/uploads/:category
const pickupSchema = z.object({
  photoUrl: z.string().min(1).max(500),
});

export async function pickupCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { photoUrl } = pickupSchema.parse(req.body);
    const delivery = await confirmPickup(req.params.id, req.user!.id, photoUrl);
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}

const validateSchema = z.object({ code: z.string().length(4) });

export async function validateCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { code } = validateSchema.parse(req.body);
    const delivery = await validateCode(req.params.id, req.user!.id, code);
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}

const cancelSchema = z.object({
  reason: z
    .enum([
      'client_cancelled',
      'driver_unavailable',
      'driver_too_far',
      'package_issue',
      'recipient_unreachable',
      'no_driver_found',
      'other',
    ])
    .optional(),
  comment: z.string().max(500).optional(),
});

export async function cancelCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = cancelSchema.safeParse(req.body ?? {});
    const reason = parsed.success ? parsed.data.reason : undefined;
    const comment = parsed.success ? parsed.data.comment : undefined;
    const delivery = await cancelDelivery(req.params.id, req.user!.id, reason, comment);
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}

export async function relaunchCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const delivery = await relaunchDelivery(req.params.id, req.user!.id);
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}

const rateSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function rateCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { score, comment } = rateSchema.parse(req.body);
    const rating = await rateDelivery({
      deliveryId: req.params.id,
      raterId: req.user!.id,
      score,
      comment,
    });
    return success(res, rating, 201);
  } catch (err) {
    next(err);
  }
}

const estimateSchema = z.object({
  packageType: z.enum(['envelope', 'small', 'large']),
  pickupLat: z.coerce.number().min(-90).max(90),
  pickupLng: z.coerce.number().min(-180).max(180),
  deliveryLat: z.coerce.number().min(-90).max(90),
  deliveryLng: z.coerce.number().min(-180).max(180),
});

export async function estimateCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const q = estimateSchema.parse(req.query);
    const result = await estimatePrice(
      q.packageType,
      q.pickupLat,
      q.pickupLng,
      q.deliveryLat,
      q.deliveryLng,
    );
    return success(res, result);
  } catch (err) {
    next(err);
  }
}
