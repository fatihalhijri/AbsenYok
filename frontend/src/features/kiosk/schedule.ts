/** Aturan waktu layar kiosk (murni, mudah diuji). */

/** Token kiosk diminta 1 dtk sebelum `expiresAt` (lalu sekali lagi saat jendela berganti). */
export const KIOSK_QR_LEAD_MS = 1_000;
/** Polling daftar "Baru saja absen". */
export const RECENT_SCANS_INTERVAL_MS = 5_000;
/** Muat ulang halaman penuh secara berkala (mencegah kebocoran memori berjam-jam). */
export const FULL_RELOAD_MS = 6 * 60 * 60 * 1000;
/** Kursor disembunyikan setelah diam selama ini. */
export const CURSOR_IDLE_MS = 3_000;

const BACKOFF_STEPS_MS = [2_000, 4_000, 8_000, 16_000];
const BACKOFF_MAX_MS = 30_000;

/** Jeda percobaan ulang setelah gagal ke-`failures` (1 = gagal pertama): 2, 4, 8, 16, 30, 30… dtk. */
export function backoffDelay(failures: number): number {
  if (failures < 1) return 0;
  return BACKOFF_STEPS_MS[failures - 1] ?? BACKOFF_MAX_MS;
}

/**
 * ID entri yang baru muncul dibanding daftar sebelumnya. Muatan pertama (`previous === null`)
 * tidak dianggap baru — agar tidak berbunyi saat layar baru dibuka.
 */
export function newScanIds(
  previous: readonly { id: string }[] | null,
  next: readonly { id: string }[],
): string[] {
  if (previous === null) return [];
  const known = new Set(previous.map((item) => item.id));
  return next.filter((item) => !known.has(item.id)).map((item) => item.id);
}
