import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isoWeek from 'dayjs/plugin/isoWeek';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(customParseFormat);

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';
export const DATE_FORMAT = 'YYYY-MM-DD';
export const TIME_FORMAT = 'HH:mm';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Momen waktu absolut (instant). Untuk tanggal kalender pakai string `YYYY-MM-DD`. */
export type Instant = Date | Dayjs | number;

let appTimezone = DEFAULT_TIMEZONE;

/** Diset sekali saat startup dari env `APP_TIMEZONE` (lihat AppModule). */
export function setAppTimezone(tz: string): void {
  // Melempar RangeError bila zona waktu tidak dikenal.
  new Intl.DateTimeFormat('en-US', { timeZone: tz });
  appTimezone = tz;
}

export function getAppTimezone(): string {
  return appTimezone;
}

export function isDateString(value: string): boolean {
  return dayjs(value, DATE_FORMAT, true).isValid();
}

export function isTimeString(value: string): boolean {
  return TIME_REGEX.test(value);
}

function assertDateString(value: string): void {
  if (!isDateString(value)) {
    throw new RangeError(`Tanggal "${value}" tidak valid, gunakan format ${DATE_FORMAT}`);
  }
}

function assertTimeString(value: string): void {
  if (!isTimeString(value)) {
    throw new RangeError(`Jam "${value}" tidak valid, gunakan format ${TIME_FORMAT}`);
  }
}

/** Waktu sekarang dalam zona `APP_TIMEZONE`. */
export function nowInTz(): Dayjs {
  return dayjs().tz(appTimezone);
}

/** Konversi instant ke zona `APP_TIMEZONE`. */
export function toTz(instant: Instant): Dayjs {
  return dayjs(instant).tz(appTimezone);
}

/** Tanggal lokal hari ini (`YYYY-MM-DD`) di zona `APP_TIMEZONE`. */
export function todayDateString(): string {
  return nowInTz().format(DATE_FORMAT);
}

/** Tanggal lokal (`YYYY-MM-DD`) dari sebuah instant, mis. tanggal absen dari waktu scan. */
export function toTzDateString(instant: Instant): string {
  return toTz(instant).format(DATE_FORMAT);
}

/**
 * Tanggal kalender → `Date` UTC 00:00 untuk kolom `@db.Date`.
 * `toDbDate('2026-10-12')` → `2026-10-12T00:00:00.000Z`.
 */
export function toDbDate(dateStr: string): Date {
  assertDateString(dateStr);
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Kebalikan `toDbDate`: nilai kolom `@db.Date` → `YYYY-MM-DD`. */
export function fromDbDate(date: Date): string {
  return dayjs.utc(date).format(DATE_FORMAT);
}

/** Geser tanggal kalender sejumlah hari (boleh negatif). `addDays('2026-10-31', 1)` → `'2026-11-01'`. */
export function addDays(dateStr: string, days: number): string {
  assertDateString(dateStr);
  return dayjs.utc(dateStr, DATE_FORMAT, true).add(days, 'day').format(DATE_FORMAT);
}

/** Tanggal lokal hari ini dalam bentuk nilai kolom `@db.Date`. */
export function todayDate(): Date {
  return toDbDate(todayDateString());
}

/**
 * Gabungkan tanggal & jam lokal `APP_TIMEZONE` menjadi instant UTC.
 * `combineDateAndTime('2026-10-12', '08:00')` (Asia/Jakarta) → `2026-10-12T01:00:00.000Z`.
 */
export function combineDateAndTime(dateStr: string, time: string): Date {
  assertDateString(dateStr);
  assertTimeString(time);
  return dayjs.tz(`${dateStr} ${time}`, `${DATE_FORMAT} ${TIME_FORMAT}`, appTimezone).toDate();
}

/**
 * Hari ISO (1 = Senin … 7 = Minggu).
 * - string `YYYY-MM-DD` → hari dari tanggal kalender tersebut
 * - instant → hari menurut zona `APP_TIMEZONE`
 * - tanpa argumen → hari ini di zona `APP_TIMEZONE`
 */
export function isoWeekday(input?: string | Instant): number {
  if (input === undefined) return nowInTz().isoWeekday();
  if (typeof input === 'string') {
    assertDateString(input);
    return dayjs.utc(input, DATE_FORMAT, true).isoWeekday();
  }
  return toTz(input).isoWeekday();
}

/** Selisih menit `later − earlier`, dibulatkan ke bawah menuju nol (detik sisa diabaikan). */
export function diffMinutes(later: Instant, earlier: Instant): number {
  return dayjs(later).diff(dayjs(earlier), 'minute');
}
