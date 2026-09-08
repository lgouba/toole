import crypto from 'node:crypto';
import { env } from '../config/env.js';

/** Canal d'envoi de l'OTP. Determine si on utilise le code dev fixe ou
 *  un code aleatoire reel. */
export type OtpChannel = 'sms' | 'whatsapp' | 'email';

/**
 * Code OTP aleatoire a 6 chiffres, genere avec un CSPRNG (crypto.randomInt).
 * 6 chiffres = 1 000 000 de combinaisons (vs 10 000 pour 4) et une source
 * cryptographique (vs Math.random, previsible).
 */
function randomOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Genere un code OTP.
 *
 * - Email : TOUJOURS un code aleatoire reel (SMTP est configure, le code
 *   arrive vraiment dans la boite mail de l'utilisateur).
 * - SMS / WhatsApp : si SMS_PROVIDER=dev (pas de provider reel configure
 *   ou en train de chercher un fournisseur), on renvoie le code fixe
 *   (par defaut "1234") pour faciliter les tests. Sinon code aleatoire.
 */
export function generateOtp(channel: OtpChannel = 'sms'): string {
  if (channel === 'email') {
    return randomOtp();
  }
  if (env.SMS_PROVIDER === 'dev') {
    return env.OTP_DEV_CODE;
  }
  return randomOtp();
}

// 10 min : compromis entre securite (fenetre d'attaque limitee) et UX
// (inscription multi-etapes driver avec photos KYC peut prendre 5-8 min).
export const OTP_EXPIRY_MS = 10 * 60 * 1000;

export function otpExpiryDate(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MS);
}
