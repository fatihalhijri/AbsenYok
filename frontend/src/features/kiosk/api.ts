import { api } from '@/lib/api-client';
import type { Kiosk, KioskQr, RecentScan } from '@/types';

export const kioskKeys = {
  all: ['kiosks'] as const,
  list: (params: object) => [...kioskKeys.all, 'list', params] as const,
  recentScans: (id: string) => [...kioskKeys.all, id, 'recent-scans'] as const,
};

export const kioskApi = {
  /** Daftar kiosk (ADMIN/SUPER_ADMIN, berpaginasi). */
  list: (params: { page?: number; limit?: number; search?: string } = {}) =>
    api.page<Kiosk>('/kiosks', params),
  /** Token QR berjalan; juga menandai kiosk "terlihat" (`lastSeenAt`). */
  qr: (id: string) => api.get<KioskQr>(`/kiosks/${id}/qr`),
  /** 10 scan berhasil terakhir hari ini. */
  recentScans: (id: string) => api.get<RecentScan[]>(`/kiosks/${id}/recent-scans`),
};
