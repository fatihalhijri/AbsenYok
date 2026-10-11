import type { Prisma } from '@/generated/prisma/client';

/**
 * Select aman untuk profil user: tidak pernah memuat `passwordHash`, `failedLoginAttempts`,
 * `lockedUntil`, maupun `boundDeviceId` mentah (hanya dipakai untuk `hasBoundDevice`).
 */
export const USER_PROFILE_SELECT = {
  id: true,
  employeeCode: true,
  name: true,
  email: true,
  phone: true,
  position: true,
  role: true,
  avatarUrl: true,
  boundDeviceId: true,
  department: { select: { id: true, name: true } },
  shift: {
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      lateToleranceMinutes: true,
      checkInOpenMinutes: true,
      workDays: true,
    },
  },
  location: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

type UserProfileRow = Prisma.UserGetPayload<{ select: typeof USER_PROFILE_SELECT }>;

/** `UserProfile` sesuai docs/API-CONTRACT.md bagian Auth. */
export type UserProfile = Omit<UserProfileRow, 'boundDeviceId'> & { hasBoundDevice: boolean };

export function toUserProfile({ boundDeviceId, ...profile }: UserProfileRow): UserProfile {
  return { ...profile, hasBoundDevice: boundDeviceId !== null };
}
