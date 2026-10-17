import { api } from '@/lib/api-client';
import type { PublicSettings, Schemas, Settings } from '@/types';

export const settingsKeys = {
  all: ['settings'] as const,
  public: () => [...settingsKeys.all, 'public'] as const,
  admin: () => [...settingsKeys.all, 'admin'] as const,
};

export const settingsApi = {
  /** Publik (tanpa login): nama & logo instansi. Di-cache service worker (StaleWhileRevalidate). */
  getPublic: () => api.get<PublicSettings>('/settings/public'),
  /** Semua pengaturan (SUPER_ADMIN & ADMIN boleh baca; ubah khusus SUPER_ADMIN). */
  get: () => api.get<Settings>('/settings'),
  update: (input: Schemas['UpdateSettingsDto']) => api.patch<Settings>('/settings', input),
};
