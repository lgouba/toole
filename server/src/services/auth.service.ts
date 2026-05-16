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
import { sendOtpMessage, type MessageChannel } from '../lib/sms.js';
import { env } from '../config/env.js';
import { emitToAdmins } from './notification.service.js';
import { sendAdminAlert } from '../lib/mailer.js';
import { getAppSettings } from './settings.service.js';

export async function sendOtp(
  phone: string,
  channel: MessageChannel = 'sms',
): Promise<{ success: true }> {
  const code = generateOtp();
  await prisma.otpCode.create({
    data: {
      phone,
      code,
      expiresAt: otpExpiryDate(),
    },
  });
  logger.info(
    { phone, channel, code: env.SMS_PROVIDER === 'dev' ? code : '****' },
    'OTP generated',
  );

  try {
    await sendOtpMessage(phone, code, channel);
  } catch (err) {
    // Si l'envoi echoue, on invalide le code pour ne pas laisser un OTP fantome.
    await prisma.otpCode.deleteMany({ where: { phone, code } });
    const isWhatsApp = channel === 'whatsapp';
    throw new HttpError(
      502,
      isWhatsApp ? 'WHATSAPP_FAILED' : 'SMS_FAILED',
      isWhatsApp
        ? "Impossible d'envoyer le code par WhatsApp. Essayez par SMS."
        : "Impossible d'envoyer le SMS. Reessayez.",
    );
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

  // Compte suspendu / desactive par l'admin : on bloque la connexion.
  // Message volontairement generique pour ne pas indiquer a un attaquant
  // si le numero est valide / suspendu / autre — on dit juste "compte
  // indisponible, contactez le support".
  if (!user.isActive) {
    logger.warn(
      { userId: user.id, phone, userType: user.userType },
      'Login attempt on inactive/suspended account',
    );
    throw new HttpError(
      403,
      'ACCOUNT_UNAVAILABLE',
      'Compte indisponible. Veuillez contacter le support.',
    );
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
  /** Code de parrainage saisi par l'utilisateur. Logge mais pas encore
   *  applique (le mecanisme bonus parrain/parraine sera ajoute plus tard). */
  referralCode?: string;
}) {
  await verifyOtpCode(args.phone, args.otpCode);
  if (args.referralCode) {
    logger.info(
      { phone: args.phone, referralCode: args.referralCode, userType: args.userType },
      'Referral code submitted at registration (no reward applied yet)',
    );
  }
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

  // Notifie les admins connectes en temps reel d'une nouvelle inscription livreur.
  if (user.userType === 'driver') {
    emitToAdmins('admin:new_driver', {
      id: user.id,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      vehicleType: user.driverProfile?.vehicleType,
      vehiclePlate: user.driverProfile?.vehiclePlate,
      createdAt: user.createdAt,
    });

    // Email d'alerte vers l'adresse configuree dans ADMIN_ALERT_EMAIL
    void (async () => {
      const settings = await getAppSettings().catch(() => null);
      const appName = settings?.appName ?? 'Tolle';
      const dob = user.dateOfBirth
        ? new Date(user.dateOfBirth).toLocaleDateString('fr-FR')
        : '—';
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">
          <div style="background: linear-gradient(135deg, #1d9e75 0%, #0f6e56 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
            <h1 style="margin: 0; font-size: 20px;">${appName} — Nouveau livreur</h1>
            <p style="margin: 4px 0 0; opacity: 0.9; font-size: 13px;">Une inscription à valider</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 8px 0; color: #6b7280; width: 130px;">Nom complet</td><td style="padding: 8px 0; font-weight: 600;">${user.fullName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Téléphone</td><td style="padding: 8px 0;">${user.phone}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Date naissance</td><td style="padding: 8px 0;">${dob}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Véhicule</td><td style="padding: 8px 0; text-transform: capitalize;">${user.driverProfile?.vehicleType ?? '—'}${user.driverProfile?.vehiclePlate ? ` · ${user.driverProfile.vehiclePlate}` : ''}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0;">${user.email ?? '—'}</td></tr>
            </table>
            <div style="margin-top: 20px; padding: 12px 14px; background: #fef3c7; border-radius: 8px; font-size: 13px; color: #92400e;">
              Ce livreur est <strong>inactif</strong> par défaut. Connectez-vous au panneau d'administration pour l'activer.
            </div>
            <a href="https://admin-tolle.qalitylabs.fr/users/${user.id}" style="display: inline-block; margin-top: 16px; padding: 10px 18px; background: #1d9e75; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Ouvrir la fiche livreur</a>
          </div>
        </div>
      `;
      const text = `${appName} — Nouveau livreur inscrit

Nom: ${user.fullName}
Téléphone: ${user.phone}
Date naissance: ${dob}
Véhicule: ${user.driverProfile?.vehicleType ?? '—'}${user.driverProfile?.vehiclePlate ? ` (${user.driverProfile.vehiclePlate})` : ''}
Email: ${user.email ?? '—'}

Ouvrir: https://admin-tolle.qalitylabs.fr/users/${user.id}`;

      await sendAdminAlert(
        `[${appName}] Nouveau livreur: ${user.fullName}`,
        html,
        text,
      );
    })();
  }

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
  // Compte suspendu / desactive : on refuse le refresh et on supprime tous
  // les refresh tokens de l'utilisateur (logout force a la prochaine
  // requete sur tous les devices).
  if (!existing.user.isActive) {
    logger.warn(
      { userId: existing.user.id },
      'Refresh attempt on inactive/suspended account — revoking all tokens',
    );
    await prisma.refreshToken.deleteMany({ where: { userId: existing.user.id } });
    throw new HttpError(
      403,
      'ACCOUNT_UNAVAILABLE',
      'Compte indisponible. Veuillez contacter le support.',
    );
  }
  await prisma.refreshToken.delete({ where: { id: existing.id } });
  return issueTokens(existing.user.id, existing.user.userType);
}
