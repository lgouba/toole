import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  userId: string;
  userType: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

/**
 * Compute the expiry date for a refresh token based on env setting.
 * Accepts simple durations like "30d", "7d", "15m", "1h" or seconds.
 */
export function refreshTokenExpiry(): Date {
  const exp = env.JWT_REFRESH_EXPIRES_IN;
  const match = /^(\d+)([smhd])$/.exec(exp);
  let seconds = 30 * 24 * 60 * 60;
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const mult =
      unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    seconds = value * mult;
  } else if (/^\d+$/.test(exp)) {
    seconds = parseInt(exp, 10);
  }
  return new Date(Date.now() + seconds * 1000);
}
