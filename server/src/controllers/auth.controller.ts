import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  sendOtp,
  verifyOtpFlow,
  registerUser,
  rotateRefreshToken,
} from '../services/auth.service.js';
import { success } from '../utils/response.js';

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, 'Invalid phone number');

const sendOtpSchema = z.object({
  phone: phoneSchema,
  /** Canal d'envoi du code. Defaut: sms. */
  channel: z.enum(['sms', 'whatsapp']).optional(),
});

export async function sendOtpCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone, channel } = sendOtpSchema.parse(req.body);
    const result = await sendOtp(phone, channel ?? 'sms');
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(4),
});

export async function verifyOtpCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone, code } = verifyOtpSchema.parse(req.body);
    const result = await verifyOtpFlow(phone, code);
    if (result.isNewUser) {
      return success(res, {
        user: null,
        accessToken: null,
        refreshToken: null,
        isNewUser: true,
      });
    }
    return success(res, {
      user: result.user,
      accessToken: result.tokens!.accessToken,
      refreshToken: result.tokens!.refreshToken,
      isNewUser: false,
    });
  } catch (err) {
    next(err);
  }
}

const registerSchema = z.object({
  phone: phoneSchema,
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  userType: z.enum(['client', 'driver', 'merchant']),
  otpCode: z.string().length(4),
  email: z.string().trim().email().optional().or(z.literal('')),
  vehicleType: z.enum(['moto', 'velo', 'voiture', 'tricycle']).optional(),
  vehiclePlate: z.string().trim().max(20).optional().or(z.literal('')),
  /** Code de parrainage saisi. La logique de bonus sera ajoutee plus tard. */
  referralCode: z.string().trim().max(20).optional().or(z.literal('')),
});

export async function registerCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body);
    const { user, tokens } = await registerUser({
      phone: body.phone,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth,
      userType: body.userType,
      otpCode: body.otpCode,
      email: body.email || undefined,
      vehicleType: body.vehicleType,
      vehiclePlate: body.vehiclePlate || undefined,
      referralCode: body.referralCode || undefined,
    });
    return success(
      res,
      {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      201,
    );
  } catch (err) {
    next(err);
  }
}

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export async function refreshCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await rotateRefreshToken(refreshToken);
    return success(res, tokens);
  } catch (err) {
    next(err);
  }
}
