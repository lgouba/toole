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

const pushTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.string().optional(),
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
    await unregisterPushToken(token);
    return success(res, { unregistered: true });
  } catch (err) {
    next(err);
  }
}
