import { User, UserRole } from '@/types';
import { api, tokenStorage, unwrap } from './api.client';

function normalizeUser(raw: any): User {
  return {
    id: raw.id,
    phone: raw.phone,
    fullName: raw.fullName,
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

export async function sendOtp(phone: string): Promise<{ success: boolean }> {
  const res = await api.post('/auth/send-otp', { phone });
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

export async function registerUser(
  phone: string,
  fullName: string,
  userType: UserRole,
  otpCode: string,
  extras?: { email?: string; vehicleType?: string }
): Promise<User> {
  const payload: Record<string, any> = { phone, fullName, userType, otpCode };
  if (extras?.email) payload.email = extras.email;
  if (extras?.vehicleType) payload.vehicleType = extras.vehicleType;
  const res = await api.post('/auth/register', payload);
  const data = unwrap<{ user: any; accessToken: string; refreshToken: string }>(res);

  await tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return normalizeUser(data.user);
}

export async function logout(): Promise<void> {
  await tokenStorage.clear();
}
