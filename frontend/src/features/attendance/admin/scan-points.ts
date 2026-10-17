import type { AttendanceDetail, ScanLog } from '@/types';

export type ScanPointKind = 'in' | 'out' | 'failed';

export interface ScanPoint {
  id: string;
  kind: ScanPointKind;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distance: number | null;
  at: string;
  errorCode: string | null;
}

export const SCAN_POINT_LABELS: Record<ScanPointKind, string> = {
  in: 'Masuk',
  out: 'Pulang',
  failed: 'Gagal',
};

/**
 * Warna titik peta (dipakai juga di legenda — modul ini aman untuk SSR, tanpa Leaflet).
 * Legenda teks & tooltip per titik memastikan identitas tidak hanya dari warna.
 */
export const SCAN_POINT_COLORS: Record<ScanPointKind, string> = {
  in: '#059669',
  out: '#0284c7',
  failed: '#e11d48',
};

const time = (value: string | null | undefined) => (value ? Date.parse(value) : null);

/** Log sukses yang waktunya paling dekat dengan `target` (jam masuk/pulang tercatat). */
function nearest(logs: ScanLog[], target: number | null): ScanLog | null {
  if (target === null) return null;
  let best: ScanLog | null = null;
  for (const log of logs) {
    if (
      !best ||
      Math.abs(Date.parse(log.createdAt) - target) < Math.abs(Date.parse(best.createdAt) - target)
    ) {
      best = log;
    }
  }
  return best;
}

/**
 * Titik peta dari log scan hari itu: scan sukses terdekat dengan jam masuk/pulang diberi label
 * Masuk/Pulang, scan gagal ditampilkan sebagai titik "Gagal". Log tanpa koordinat dilewati.
 * Jam yang dikoreksi manual tidak punya log → tidak ada titik untuk sisi tersebut.
 */
export function scanPoints(
  detail: Pick<
    AttendanceDetail,
    'scanLogs' | 'checkInAt' | 'checkOutAt' | 'checkInMethod' | 'checkOutMethod'
  >,
): ScanPoint[] {
  const located = detail.scanLogs.filter(
    (log) => typeof log.latitude === 'number' && typeof log.longitude === 'number',
  );
  const successes = located.filter((log) => log.success);
  const scanned = (method: string | null | undefined) =>
    method === 'KIOSK_QR' || method === 'PERSONAL_QR';

  const checkIn = scanned(detail.checkInMethod) ? nearest(successes, time(detail.checkInAt)) : null;
  const checkOut = scanned(detail.checkOutMethod)
    ? nearest(
        successes.filter((log) => log !== checkIn),
        time(detail.checkOutAt),
      )
    : null;

  return located
    .filter((log) => !log.success || log === checkIn || log === checkOut)
    .map((log) => ({
      id: log.id,
      kind: log === checkIn ? 'in' : log === checkOut ? 'out' : 'failed',
      latitude: log.latitude as number,
      longitude: log.longitude as number,
      accuracy: log.accuracy ?? null,
      distance: log.distance ?? null,
      at: log.createdAt,
      errorCode: log.errorCode ?? null,
    }));
}
