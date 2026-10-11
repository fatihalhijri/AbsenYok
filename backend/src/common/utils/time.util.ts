import { isTimeString } from './date.util';

export const MINUTES_PER_DAY = 1_440;

/** `'08:30'` → 510 (menit sejak 00:00). */
export function timeToMinutes(time: string): number {
  if (!isTimeString(time)) {
    throw new RangeError(`Jam "${time}" tidak valid, gunakan format HH:mm`);
  }
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * `'5,1,3'` → `[1, 3, 5]`. `null` bila format salah, ada angka di luar 1–7, atau duplikat.
 * Hari kerja memakai ISO weekday: 1 = Senin … 7 = Minggu.
 */
export function parseWorkDays(value: string): number[] | null {
  if (!/^[1-7](,[1-7])*$/.test(value.replace(/\s+/g, ''))) return null;
  const days = value.replace(/\s+/g, '').split(',').map(Number);
  if (new Set(days).size !== days.length) return null;
  return [...days].sort((a, b) => a - b);
}

/** `[1, 2, 3]` → `'1,2,3'` (format kolom `shifts.workDays`). */
export function formatWorkDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).join(',');
}
