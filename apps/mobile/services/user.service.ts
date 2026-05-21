import { User } from '@/types';
import { api, unwrap } from './api.client';

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

export async function getMe(): Promise<User> {
  const res = await api.get('/users/me');
  const raw = unwrap<any>(res);
  return normalizeUser(raw);
}
