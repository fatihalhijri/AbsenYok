import { api } from '@/lib/api-client';
import type { PublicSettings } from '@/types';

export const settingsKeys = {
  all: ['settings'] as const,
  public: () => [...settingsKeys.all, 'public'] as const,
};

export const settingsApi = {
  /** Publik (tanpa login): nama & logo instansi. Di-cache service worker (StaleWhileRevalidate). */
  getPublic: () => api.get<PublicSettings>('/settings/public'),
};
