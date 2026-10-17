import { api } from '@/lib/api-client';
import type { Kiosk, KioskInput, KioskQr, RecentScan, Schemas } from '@/types';

export const kioskKeys = {
  all: ['kiosks'] as const,
  list: (params: object) => [...kioskKeys.all, 'list', params] as const,
  recentScans: (id: string) => [...kioskKeys.all, id, 'recent-scans'] as const,
};

export const kioskApi = {
  /** Daftar kiosk (ADMIN/SUPER_ADMIN, berpaginasi). */
  list: (params: Record<string, string | number> = {}) => api.page<Kiosk>('/kiosks', params),
  create: (input: KioskInput) => api.post<Kiosk>('/kiosks', input),
  update: (id: string, input: Schemas['UpdateKioskDto']) =>
    api.patch<Kiosk>(`/kiosks/${id}`, input),
  /** Secret baru → semua QR lama (termasuk yang sedang tampil) langsung tidak berlaku. */
  rotateSecret: (id: string) => api.post<Kiosk>(`/kiosks/${id}/rotate-secret`),
  /** Token QR berjalan; juga menandai kiosk "terlihat" (`lastSeenAt`). */
  qr: (id: string) => api.get<KioskQr>(`/kiosks/${id}/qr`),
  /** 10 scan berhasil terakhir hari ini. */
  recentScans: (id: string) => api.get<RecentScan[]>(`/kiosks/${id}/recent-scans`),
};
