import { User, UserRole } from '@/types';
import { api, tokenStorage, unwrap } from './api.client';

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
      user?: User;
      isNewUser: boolean;
      accessToken?: string;
      refreshToken?: string;
    }>(res);

    if (data.accessToken && data.refreshToken) {
      await tokenStorage.setTokens(data.accessToken, data.refreshToken);
    }

    return { success: true, ...data };
  } catch (e) {
    return { success: false, isNewUser: false };
  }
}

export async function registerUser(
  phone: string,
  fullName: string,
  userType: UserRole,
  otpCode: string
): Promise<User> {
  const res = await api.post('/auth/register', { phone, fullName, userType, otpCode });
  const data = unwrap<{ user: User; accessToken: string; refreshToken: string }>(res);

  await tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function logout(): Promise<void> {
  await tokenStorage.clear();
}
