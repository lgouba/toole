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

const sendOtpSchema = z.object({ phone: phoneSchema });

export async function sendOtpCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone } = sendOtpSchema.parse(req.body);
    const result = await sendOtp(phone);
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
  fullName: z.string().min(2).max(100),
  userType: z.enum(['client', 'driver', 'merchant']),
  otpCode: z.string().length(4),
});

export async function registerCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body);
    const { user, tokens } = await registerUser(body);
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
