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

export type OtpChannel = 'sms' | 'whatsapp';

export async function sendOtp(
  phone: string,
  channel: OtpChannel = 'sms',
): Promise<{ success: boolean }> {
  const res = await api.post('/auth/send-otp', { phone, channel });
  return unwrap(res);
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<{
  success: boolean;
  user?: User;
  isNewUser: boolean;
  accessToken?: string;
  refreshToken?: string;
}> {
  try {
    const res = await api.post('/auth/verify-otp', { phone, code });
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
  } catch {
    return { success: false, isNewUser: false };
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
