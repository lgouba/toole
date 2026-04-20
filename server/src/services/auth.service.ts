import { UserRole, VehicleType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  signAccessToken,
  signRefreshToken,
  refreshTokenExpiry,
} from '../lib/jwt.js';
import { generateOtp, otpExpiryDate } from '../lib/otp.js';
import { HttpError } from '../utils/response.js';
import { logger } from '../lib/logger.js';
import { sendSms } from '../lib/sms.js';
import { env } from '../config/env.js';

export async function sendOtp(phone: string): Promise<{ success: true }> {
  const code = generateOtp();
  await prisma.otpCode.create({
    data: {
      phone,
      code,
      expiresAt: otpExpiryDate(),
    },
  });
  logger.info({ phone, code: env.SMS_PROVIDER === 'dev' ? code : '****' }, 'OTP generated');

  try {
    await sendSms(
      phone,
      `Tolle: votre code de verification est ${code}. Valide 5 minutes.`,
    );
  } catch (err) {
    // Si l'envoi SMS echoue, on invalide le code pour ne pas laisser un OTP fantome.
    await prisma.otpCode.deleteMany({ where: { phone, code } });
    throw new HttpError(502, 'SMS_FAILED', 'Impossible d\'envoyer le SMS. Reessayez.');
  }

  return { success: true };
}

export async function verifyOtpCode(phone: string, code: string): Promise<void> {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, code },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) {
    throw new HttpError(400, 'INVALID_OTP', 'Invalid verification code');
  }
  if (otp.expiresAt < new Date()) {
    throw new HttpError(400, 'EXPIRED_OTP', 'Verification code has expired');
  }
}

export async function issueTokens(userId: string, userType: string) {
  const accessToken = signAccessToken({ userId, userType });
  const refreshToken = signRefreshToken({ userId, userType });
  await prisma.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt: refreshTokenExpiry(),
    },
  });
  return { accessToken, refreshToken };
}

export async function verifyOtpFlow(phone: string, code: string) {
  await verifyOtpCode(phone, code);
  const user = await prisma.user.findUnique({
    where: { phone },
    include: { driverProfile: true },
  });
  if (!user) {
    return { user: null, tokens: null, isNewUser: true as const };
  }
  const tokens = await issueTokens(user.id, user.userType);
  return { user, tokens, isNewUser: false as const };
}

export async function registerUser(args: {
  phone: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date (YYYY-MM-DD)
  userType: UserRole;
  otpCode: string;
  email?: string;
  vehicleType?: VehicleType;
  vehiclePlate?: string;
}) {
  await verifyOtpCode(args.phone, args.otpCode);
  const existing = await prisma.user.findUnique({ where: { phone: args.phone } });
  if (existing) {
    throw new HttpError(409, 'USER_EXISTS', 'A user with this phone already exists');
  }
  const email = args.email?.trim() || null;
  const firstName = args.firstName.trim();
  const lastName = args.lastName.trim();
  const fullName = `${firstName} ${lastName}`;
  const dob = new Date(args.dateOfBirth);
  const plate = args.vehiclePlate?.trim() || null;

  // Les livreurs ne sont pas actifs par defaut : l'admin doit valider.
  const isActive = args.userType !== 'driver';

  const user = await prisma.user.create({
    data: {
      phone: args.phone,
      firstName,
      lastName,
      fullName,
      dateOfBirth: dob,
      userType: args.userType,
      email,
      isVerified: true,
      isActive,
      ...(args.userType === 'driver'
        ? {
            driverProfile: {
              create: {
                vehicleType: args.vehicleType ?? 'moto',
                vehiclePlate: plate,
                verificationStatus: 'pending',
              },
            },
          }
        : {}),
    },
    include: { driverProfile: true },
  });
  const tokens = await issueTokens(user.id, user.userType);
  return { user, tokens };
}

export async function rotateRefreshToken(oldToken: string) {
  const existing = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: true },
  });
  if (!existing || existing.expiresAt < new Date()) {
    throw new HttpError(401, 'INVALID_REFRESH', 'Invalid or expired refresh token');
  }
  await prisma.refreshToken.delete({ where: { id: existing.id } });
  return issueTokens(existing.user.id, existing.user.userType);
}
