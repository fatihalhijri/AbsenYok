import type { Prisma } from '@/generated/prisma/client';

/**
 * Select aman untuk semua respons user: TIDAK memuat `passwordHash`, `failedLoginAttempts`,
 * `lockedUntil`, maupun `deletedAt`. `boundDeviceId` hanya dipakai untuk `hasBoundDevice`.
 */
export const USER_SAFE_SELECT = {
  id: true,
  employeeCode: true,
  name: true,
  email: true,
  phone: true,
  position: true,
  role: true,
  isActive: true,
  avatarUrl: true,
  boundDeviceId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, code: true, name: true } },
  shift: { select: { id: true, name: true, startTime: true, endTime: true } },
  location: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SAFE_SELECT }>;

export type UserDetail = Omit<UserRow, 'boundDeviceId'> & { hasBoundDevice: boolean };

export function toUserDetail({ boundDeviceId, ...user }: UserRow): UserDetail {
  return { ...user, hasBoundDevice: boundDeviceId !== null };
}
