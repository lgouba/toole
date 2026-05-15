import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthedRequest } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import {
  validatePromoCode,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  listPromoCodes,
} from '../services/promo.service.js';

// ============================================================
// Client : valider un code avant submit
// ============================================================

const validateSchema = z.object({
  code: z.string().trim().min(3).max(30),
  orderAmount: z.number().int().min(0),
});

export async function validatePromoCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = validateSchema.parse(req.body);
    const result = await validatePromoCode(
      body.code,
      req.user!.id,
      body.orderAmount,
    );
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// ============================================================
// Admin CRUD
// ============================================================

const createSchema = z.object({
  code: z.string().trim().min(3).max(30),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().int().min(1).max(1_000_000),
  minOrderAmount: z.number().int().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  maxUsesPerUser: z.number().int().min(1).optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(500).optional(),
});

export async function adminListPromoCtrl(
  _req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const list = await listPromoCodes();
    return success(res, list);
  } catch (err) {
    next(err);
  }
}

export async function adminCreatePromoCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = createSchema.parse(req.body);
    const promo = await createPromoCode({
      ...body,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validTo: body.validTo ? new Date(body.validTo) : undefined,
      createdBy: req.user!.id,
    });
    return success(res, promo, 201);
  } catch (err) {
    next(err);
  }
}

const updateSchema = createSchema.partial();

export async function adminUpdatePromoCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id;
    const body = updateSchema.parse(req.body);
    const promo = await updatePromoCode(id, {
      ...body,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validTo: body.validTo ? new Date(body.validTo) : undefined,
    });
    return success(res, promo);
  } catch (err) {
    next(err);
  }
}

export async function adminDeletePromoCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await deletePromoCode(req.params.id);
    return success(res, { ok: true });
  } catch (err) {
    next(err);
  }
}
