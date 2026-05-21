import { env } from '../config/env.js';

export function generateOtp(): string {
  // En mode dev, on renvoie toujours le code configure (par defaut "1234").
  if (env.SMS_PROVIDER === 'dev') {
    return env.OTP_DEV_CODE;
  }
  // En production (AT), on genere un code aleatoire a 4 chiffres.
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// 10 min : compromis entre securite (fenetre d'attaque limitee) et UX
// (inscription multi-etapes driver avec photos KYC peut prendre 5-8 min).
export const OTP_EXPIRY_MS = 10 * 60 * 1000;

export function otpExpiryDate(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MS);
}
