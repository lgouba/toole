import { env } from '../config/env.js';

export function generateOtp(): string {
  // If OTP_DEV_CODE is explicitly set, always use it (for test envs on VPS).
  if (env.OTP_DEV_CODE) {
    return env.OTP_DEV_CODE;
  }
  // Cryptographically unnecessary here; a 4 digit code is fine.
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function otpExpiryDate(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MS);
}
