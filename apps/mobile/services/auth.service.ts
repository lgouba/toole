import { User, UserRole } from '@/types';
import { api, tokenStorage, unwrap } from './api.client';

function normalizeUser(raw: any): User {
  return {
    id: raw.id,
    phone: raw.phone,
    firstName: raw.firstName ?? undefined,
    lastName: raw.lastName ?? undefined,
    fullName: raw.fullName,
    dateOfBirth: raw.dateOfBirth ?? undefined,
    email: raw.email ?? undefined,
    userType: raw.userType,
    avatarUrl: raw.avatarUrl ?? undefined,
    isVerified: !!raw.isVerified,
    isActive: !!raw.isActive,
    ratingAvg: Number(raw.ratingAvg ?? 5),
    ratingCount: Number(raw.ratingCount ?? 0),
    createdAt: raw.createdAt,
  };
}

export type OtpChannel = 'sms' | 'whatsapp' | 'email';

/**
 * Detecte si l'identifier saisi par l'utilisateur est un email.
 * Sinon, considere comme phone.
 */
export function isEmail(identifier: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim());
}

export async function sendOtp(
  identifier: string,
  channel: OtpChannel = 'sms',
  purpose?: 'login' | 'register',
): Promise<{ success: boolean }> {
  // Si l'identifier est un email, on force le canal email automatiquement.
  const effectiveChannel = isEmail(identifier) ? 'email' : channel;
  const res = await api.post('/auth/send-otp', {
    identifier,
    channel: effectiveChannel,
    purpose,
  });
  return unwrap(res);
}

export async function verifyOtp(
  identifier: string,
  code: string
): Promise<{
  success: boolean;
  user?: User;
  isNewUser: boolean;
  accessToken?: string;
  refreshToken?: string;
  /** Code d'erreur API si success=false (ex: ACCOUNT_UNAVAILABLE, INVALID_OTP). */
  errorCode?: string;
  /** Message d'erreur affichable si success=false. */
  errorMessage?: string;
}> {
  try {
    const res = await api.post('/auth/verify-otp', { identifier, code });
    const data = unwrap<{
      user?: any;
      isNewUser: boolean;
      accessToken?: string;
      refreshToken?: string;
    }>(res);

    if (data.accessToken && data.refreshToken) {
      await tokenStorage.setTokens(data.accessToken, data.refreshToken);
    }

    return {
      success: true,
      user: data.user ? normalizeUser(data.user) : undefined,
      isNewUser: data.isNewUser,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  } catch (err: any) {
    const errorCode = err?.response?.data?.error?.code as string | undefined;
    const errorMessage = err?.response?.data?.error?.message as string | undefined;
    return { success: false, isNewUser: false, errorCode, errorMessage };
  }
}

export interface RegisterPayload {
  phone: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  userType: UserRole;
  otpCode: string;
  email?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  /** Code de parrainage saisi (la logique de bonus sera ajoutee plus tard) */
  referralCode?: string;
}

export async function registerUser(payload: RegisterPayload): Promise<User> {
  const body: Record<string, any> = {
    phone: payload.phone,
    firstName: payload.firstName,
    lastName: payload.lastName,
    dateOfBirth: payload.dateOfBirth,
    userType: payload.userType,
    otpCode: payload.otpCode,
  };
  if (payload.email) body.email = payload.email;
  if (payload.vehicleType) body.vehicleType = payload.vehicleType;
  if (payload.vehiclePlate) body.vehiclePlate = payload.vehiclePlate;
  if (payload.referralCode) body.referralCode = payload.referralCode;

  const res = await api.post('/auth/register', body);
  const data = unwrap<{ user: any; accessToken: string; refreshToken: string }>(res);

  await tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return normalizeUser(data.user);
}

export async function logout(): Promise<void> {
  await tokenStorage.clear();
}
