/**
 * Penjadwalan token QR dinamis (kiosk & personal) — docs/QR-SECURITY.md.
 *
 * Backend membuat token per jendela waktu yang SEDANG berjalan (`expiresAt` = akhir jendela) dan
 * masih menerima token jendela sebelumnya. Maka:
 * - token diminta `leadMs` sebelum `expiresAt` (agar siap tepat waktu), lalu
 * - bila token itu diterima di dalam `leadMs` terakhir (jendela sama → token belum berganti),
 *   diminta sekali lagi tepat setelah jendela berganti (`expiresAt + rolloverMs`).
 * Semua waktu dikoreksi selisih jam server−perangkat dari `serverTime`.
 */

export interface TimedQr {
  expiresAt: string;
  serverTime: string;
}

export interface QrScheduleOptions {
  leadMs: number;
  /** Jeda setelah jendela berganti sebelum meminta token berikutnya. */
  rolloverMs?: number;
  /** Jeda minimum antar-refresh (melindungi dari jam/expiresAt yang aneh). */
  minMs?: number;
}

/** Selisih jam server − jam perangkat (ms) saat token diterima. */
export const clockOffset = (qr: Pick<TimedQr, 'serverTime'>, receivedAt: number) =>
  Date.parse(qr.serverTime) - receivedAt;

/** Jeda (ms, dari `now` jam perangkat) sampai token berikutnya perlu diminta. */
export function qrRefreshDelay(
  qr: TimedQr,
  receivedAt: number,
  now: number,
  { leadMs, rolloverMs = 300, minMs = 250 }: QrScheduleOptions,
): number {
  const expiresAtDevice = Date.parse(qr.expiresAt) - clockOffset(qr, receivedAt);
  const leadAt = expiresAtDevice - leadMs;
  const target = receivedAt < leadAt ? leadAt : expiresAtDevice + rolloverMs;
  return Math.max(minMs, target - now);
}

/**
 * Apakah token masih aman ditampilkan pada jam server `serverNow`: backend menerima jendela
 * berjalan + satu jendela sebelumnya, jadi token sah sampai `expiresAt + interval`. Disisakan
 * `marginMs` agar orang yang sedang memindai tidak mendapat QR_EXPIRED.
 */
export function isQrDisplayable(
  qr: { expiresAt: string },
  intervalSeconds: number,
  serverNow: number,
  marginMs = 3_000,
): boolean {
  return serverNow < Date.parse(qr.expiresAt) + intervalSeconds * 1000 - marginMs;
}
