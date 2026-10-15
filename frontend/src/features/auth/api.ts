import { api } from '@/lib/api-client';
import type { AuthTokenResponse, UserProfile } from '@/types';
import type { ChangePasswordInput, LoginInput } from './schemas';

/** Endpoint Auth (docs/API-CONTRACT.md § Auth). Cookie refresh dikelola browser (httpOnly). */
export const authApi = {
  login: (input: LoginInput) => api.post<AuthTokenResponse>('/auth/login', input),
  /** Pulihkan sesi dari cookie refresh — single-flight & aman lintas tab (lihat api-client). */
  refresh: () => api.refreshSession(),
  logout: () => api.post<null>('/auth/logout'),
  me: () => api.get<UserProfile>('/auth/me'),
  changePassword: ({ currentPassword, newPassword }: ChangePasswordInput) =>
    api.patch<null>('/auth/change-password', { currentPassword, newPassword }),
};
