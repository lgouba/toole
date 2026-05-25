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

/** Phone OU email. Tolere les deux formes : digits ou format email. */
const identifierSchema = z
  .string()
  .trim()
  .min(3)
  .refine(
    (v) =>
      /^\+?[0-9]{8,15}$/.test(v) ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    { message: 'Doit etre un numero (8-15 chiffres) ou un email valide' },
  );

const sendOtpSchema = z.object({
  // Accepte phone ou email. `phone` reste accepte pour retrocompatibilite.
  identifier: identifierSchema.optional(),
  phone: phoneSchema.optional(),
  /** Canal d'envoi. Defaut: deduit (sms si phone, email si email). */
  channel: z.enum(['sms', 'whatsapp', 'email']).optional(),
  /** Verifie l'existence du compte selon l'usage. Si non fourni, pas de check. */
  purpose: z.enum(['login', 'register']).optional(),
});

export async function sendOtpCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const body = sendOtpSchema.parse(req.body);
    const identifier = body.identifier ?? body.phone;
    if (!identifier) {
      return next(
        new Error('Vous devez fournir un numero de telephone ou un email.'),
      );
    }
    // ⚠️ Default 'login' : si le client n'a pas explicitement specifie
    // 'register', on considere que c'est une demande de connexion et on verifie
    // que le numero existe avant d'envoyer le SMS (anti-gaspillage Aqilas +
    // anti-enumeration). Les anciens builds mobile sans champ `purpose`
    // beneficient automatiquement de cette protection.
    const result = await sendOtp(
      identifier,
      body.channel ?? 'sms',
      body.purpose ?? 'login',
    );
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

const verifyOtpSchema = z.object({
  identifier: identifierSchema.optional(),
  phone: phoneSchema.optional(),
  code: z.string().length(4),
});

export async function verifyOtpCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const body = verifyOtpSchema.parse(req.body);
    const identifier = body.identifier ?? body.phone;
    if (!identifier) {
      return next(
        new Error('Vous devez fournir un numero de telephone ou un email.'),
      );
    }
    const result = await verifyOtpFlow(identifier, body.code);
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
  // Email obligatoire pour pouvoir recevoir l'OTP par email + recuperation de compte.
  email: z.string().trim().email('Email invalide'),
  vehicleType: z.enum(['moto', 'velo', 'voiture', 'tricycle']).optional(),
  vehiclePlate: z.string().trim().max(20).optional().or(z.literal('')),
  /** URLs des photos d'identite KYC uploadees prealablement (/uploads/kyc/*).
   *  Attachees au driverProfile a la creation, en meme temps que le user
   *  (puisque PUT /drivers/me/kyc apres register echouerait : le compte
   *  est isActive=false donc authRequired rejette). */
  cnibPhotoUrl: z.string().max(500).optional(),
  cnibPhotoBackUrl: z.string().max(500).optional(),
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
      email: body.email,
      vehicleType: body.vehicleType,
      vehiclePlate: body.vehiclePlate || undefined,
      cnibPhotoUrl: body.cnibPhotoUrl || undefined,
      cnibPhotoBackUrl: body.cnibPhotoBackUrl || undefined,
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
