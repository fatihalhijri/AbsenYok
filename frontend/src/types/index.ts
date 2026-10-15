import type { components } from './api';

/** Alias tipe dari skema OpenAPI backend (`npm run gen:api`). */
export type Schemas = components['schemas'];

export type UserProfile = Schemas['UserProfileEntity'];
export type AuthTokenResponse = Schemas['AuthTokenEntity'];
export type PublicSettings = Schemas['PublicSettingsEntity'];
export type Role = UserProfile['role'];

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'SICK' | 'PERMIT' | 'LEAVE';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
