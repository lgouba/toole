import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AuthedRequest } from '../middleware/auth.js';
import { success } from '../utils/response.js';

export async function getMe(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { driverProfile: true },
    });
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

const updateMeSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
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
