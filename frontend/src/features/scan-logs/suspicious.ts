import { toDateString } from '@/lib/date';
import type { ScanLog } from '@/types';

/** Kode gagal yang menandakan percobaan curang/perangkat lain (prompt FE-09). */
export const SUSPICIOUS_CODES = ['OUTSIDE_GEOFENCE', 'DEVICE_MISMATCH'] as const;
export type SuspiciousCode = (typeof SUSPICIOUS_CODES)[number];

/** Jumlah minimal kegagalan mencurigakan per karyawan per hari untuk diberi tanda. */
export const SUSPICIOUS_THRESHOLD = 3;

export interface SuspiciousUser {
  userId: string;
  name: string;
  total: number;
  byCode: Record<SuspiciousCode, number>;
}

const isSuspiciousCode = (code: string | null | undefined): code is SuspiciousCode =>
  (SUSPICIOUS_CODES as readonly string[]).includes(code ?? '');

/**
 * Karyawan dengan ≥ 3 kegagalan `OUTSIDE_GEOFENCE`/`DEVICE_MISMATCH` pada `date` (zona aplikasi).
 * Log tanpa user (QR tidak valid) diabaikan; log duplikat (id sama) dihitung sekali.
 */
export function findSuspiciousUsers(
  logs: readonly ScanLog[],
  date: string,
  threshold = SUSPICIOUS_THRESHOLD,
): Map<string, SuspiciousUser> {
  const seen = new Set<string>();
  const counts = new Map<string, SuspiciousUser>();
  for (const log of logs) {
    if (seen.has(log.id)) continue;
    seen.add(log.id);
    if (log.success || !log.user || !isSuspiciousCode(log.errorCode)) continue;
    if (toDateString(log.createdAt) !== date) continue;
    const entry = counts.get(log.user.id) ?? {
      userId: log.user.id,
      name: log.user.name,
      total: 0,
      byCode: { OUTSIDE_GEOFENCE: 0, DEVICE_MISMATCH: 0 },
    };
    entry.total += 1;
    entry.byCode[log.errorCode] += 1;
    counts.set(log.user.id, entry);
  }
  return new Map([...counts].filter(([, entry]) => entry.total >= threshold));
}
