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
import { sendAdminAlert, sendEmail } from '../lib/mailer.js';
import { getAppSettings } from './settings.service.js';

/**
 * Detecte si un identifier est un email (sinon considere comme phone).
 * Phone : suite de chiffres avec eventuellement un + au debut.
 * Email : doit contenir @ et un .
 */
export function isEmailIdentifier(identifier: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim());
}

/** Normalise un identifier pour la DB : email lowercase, phone digits-only. */
export function normalizeIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (isEmailIdentifier(trimmed)) return trimmed.toLowerCase();
  return trimmed.replace(/\D/g, '');
}

/**
 * Envoie un OTP au phone OU email donne. Le canal est deduit :
 *   - email -> email (SMTP Hostinger)
 *   - phone -> SMS par defaut, ou WhatsApp si channel='whatsapp'
 *
 * `purpose` permet de differencier login (compte doit exister) et register
 * (compte ne doit PAS exister). Si pas fourni, comportement legacy (envoi
 * sans verification — pour retro-compatibilite).
 */
export async function sendOtp(
  identifier: string,
  channel: MessageChannel | 'email' = 'sms',
  purpose?: 'login' | 'register',
): Promise<{ success: true }> {
  const normalized = normalizeIdentifier(identifier);
  const isEmail = isEmailIdentifier(normalized);

  if (isEmail && channel !== 'email') channel = 'email';
  if (!isEmail && channel === 'email') channel = 'sms';

  // Verification de l'existence du compte selon le purpose.
  // - 'login'    : refuse si le numero/email n'est PAS en base (anti-gaspillage
  //                SMS Aqilas + anti-enumeration)
  // - 'register' : refuse si le numero/email EST deja en base
  // - undefined  : pas de check (wallet OTP, ou cas internes)
  // Message d'erreur volontairement generique pour ne pas reveler a un
  // attaquant si un identifier existe ou non dans la base.
  if (purpose === 'login' || purpose === 'register') {
    const existing = await prisma.user.findFirst({
      where: isEmail ? { email: normalized } : { phone: normalized },
      select: { id: true },
    });
    logger.info(
      { identifier: normalized, purpose, existsInDb: !!existing },
      'OTP request : checking identifier existence',
    );
    if (purpose === 'login' && !existing) {
      throw new HttpError(
        404,
        'IDENTIFIER_INVALID',
        'Impossible d\'envoyer le code. Verifiez vos informations.',
      );
    }
    if (purpose === 'register' && existing) {
      throw new HttpError(
        409,
        'IDENTIFIER_INVALID',
        'Impossible d\'envoyer le code. Verifiez vos informations.',
      );
    }
  }

  // OTP : code reel pour email (SMTP livre vraiment), code dev pour SMS
  // tant que le provider SMS reel n'est pas branche.
  const code = generateOtp(channel);
  await prisma.otpCode.create({
    data: {
      identifier: normalized,
      code,
      expiresAt: otpExpiryDate(),
    },
  });
  logger.info(
    {
      identifier: normalized,
      channel,
      code: env.SMS_PROVIDER === 'dev' ? code : '****',
    },
    'OTP generated',
  );

  try {
    if (isEmail) {
      await sendEmail({
        to: normalized,
        subject: 'Votre code Tollé',
        html: `<p>Votre code de vérification Tollé : <b style="font-size:22px">${code}</b></p><p>Ce code expire dans 10 minutes.</p>`,
        text: `Votre code Tolle : ${code} (valide 10 min)`,
        // Si le mail ne part pas, on remonte une vraie erreur a l'utilisateur
        // (sinon il attend un mail qui n'arrivera jamais).
        throwOnError: true,
      });
    } else {
      await sendOtpMessage(normalized, code, channel as MessageChannel);
    }
  } catch (err) {
    await prisma.otpCode.deleteMany({
      where: { identifier: normalized, code },
    });
    if (isEmail) {
      throw new HttpError(
        502,
        'EMAIL_FAILED',
        "Impossible d'envoyer le code par email. Verifiez l'adresse.",
      );
    }
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

export async function verifyOtpCode(identifier: string, code: string): Promise<void> {
  const normalized = normalizeIdentifier(identifier);
  const otp = await prisma.otpCode.findFirst({
    where: { identifier: normalized, code },
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

export async function verifyOtpFlow(identifier: string, code: string) {
  const normalized = normalizeIdentifier(identifier);
  await verifyOtpCode(normalized, code);
  // L'identifier peut etre soit un phone soit un email. On cherche par les deux.
  const isEmail = isEmailIdentifier(normalized);
  const user = await prisma.user.findFirst({
    where: isEmail ? { email: normalized } : { phone: normalized },
    include: { driverProfile: true },
  });
  if (!user) {
    return { user: null, tokens: null, isNewUser: true as const };
  }

  if (!user.isActive) {
    logger.warn(
      { userId: user.id, identifier: normalized, userType: user.userType, verificationStatus: user.driverProfile?.verificationStatus },
      'Login attempt on inactive/suspended account',
    );
    // KYC rejete : message specifique avec la note de l'admin si dispo.
    if (
      user.userType === 'driver' &&
      user.driverProfile?.verificationStatus === 'rejected'
    ) {
      throw new HttpError(
        403,
        'DRIVER_KYC_REJECTED',
        user.driverProfile.verificationNote ??
          'Vos justificatifs ont ete rejetes. Contactez le support pour plus d\'informations.',
      );
    }
    // Pour TOUT autre livreur inactif (status pending OU profile manquant),
    // on considere qu'il est en attente de validation KYC. C'est le cas le plus
    // courant : compte tout neuf cree par /auth/register avec isActive=false.
    if (user.userType === 'driver') {
      throw new HttpError(
        403,
        'DRIVER_KYC_PENDING',
        "Vos justificatifs sont en cours de validation par notre equipe. Vous serez notifie des l'activation de votre compte (24-48h).",
      );
    }
    // Compte client/merchant suspendu : message generique.
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
  /** URLs photos KYC (driver). Attachees au profil a la creation. */
  cnibPhotoUrl?: string;
  cnibPhotoBackUrl?: string;
  /** Code de parrainage saisi par l'utilisateur. Logge mais pas encore
   *  applique (le mecanisme bonus parrain/parraine sera ajoute plus tard). */
  referralCode?: string;
}) {
  // L'OTP peut avoir ete envoye sur le phone OU sur l'email. On cherche les
  // deux pour valider. Le client mobile envoie le canal effectif via otpChannel.
  const phoneNormalized = args.phone.replace(/\D/g, '');
  const emailNormalized = args.email?.trim().toLowerCase() || null;

  let otpValidated = false;
  try {
    await verifyOtpCode(phoneNormalized, args.otpCode);
    otpValidated = true;
  } catch {
    // OTP pas sur le phone, on essaie sur l'email si fourni.
  }
  if (!otpValidated && emailNormalized) {
    await verifyOtpCode(emailNormalized, args.otpCode);
    otpValidated = true;
  }
  if (!otpValidated) {
    throw new HttpError(400, 'INVALID_OTP', 'Invalid verification code');
  }

  if (args.referralCode) {
    logger.info(
      { phone: args.phone, referralCode: args.referralCode, userType: args.userType },
      'Referral code submitted at registration (no reward applied yet)',
    );
  }
  // On verifie unicite du phone ET de l'email (si fourni).
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: phoneNormalized },
        ...(emailNormalized ? [{ email: emailNormalized }] : []),
      ],
    },
  });
  if (existing) {
    throw new HttpError(409, 'USER_EXISTS', 'A user with this phone or email already exists');
  }
  const email = emailNormalized;
  const firstName = args.firstName.trim();
  const lastName = args.lastName.trim();
  const fullName = `${firstName} ${lastName}`;
  const dob = new Date(args.dateOfBirth);
  const plate = args.vehiclePlate?.trim() || null;

  // Les livreurs ne sont pas actifs par defaut : l'admin doit valider.
  const isActive = args.userType !== 'driver';

  const user = await prisma.user.create({
    data: {
      phone: phoneNormalized,
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
                cnibPhotoUrl: args.cnibPhotoUrl ?? null,
                cnibPhotoBackUrl: args.cnibPhotoBackUrl ?? null,
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
