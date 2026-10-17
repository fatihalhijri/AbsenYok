import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/id';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { env } from '@/lib/env';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);
dayjs.locale('id');

/** Zona waktu bisnis (sama dengan APP_TIMEZONE backend). */
export const APP_TIMEZONE = env.NEXT_PUBLIC_APP_TIMEZONE;

export const DATE_FORMAT = 'YYYY-MM-DD';
export const MONTH_FORMAT = 'YYYY-MM';

type DateInput = string | number | Date | Dayjs;

/** Waktu di zona aplikasi (bukan zona perangkat). */
export const inAppTz = (value?: DateInput) => dayjs(value).tz(APP_TIMEZONE);

/** Tanggal lokal `YYYY-MM-DD` dari instant (mis. `checkInAt`). */
export const toDateString = (value: DateInput) => inAppTz(value).format(DATE_FORMAT);

/** `'2026-10-12'` → "Senin, 12 Oktober 2026". Tanggal kalender (tanpa jam) tidak digeser zona. */
export const formatDateLong = (date: string) =>
  dayjs(date, DATE_FORMAT).format('dddd, D MMMM YYYY');

/** `'2026-10-12'` → "12 Okt 2026". */
export const formatDateShort = (date: string) => dayjs(date, DATE_FORMAT).format('D MMM YYYY');

/** `'2026-10'` → "Oktober 2026". */
export const formatMonth = (month: string) => dayjs(month, MONTH_FORMAT).format('MMMM YYYY');

/** Jam 24 jam di zona aplikasi: "08:05". */
export const formatTime = (value: DateInput) => inAppTz(value).format('HH:mm');

/** Tanggal + jam: "12 Okt 2026 08:05". */
export const formatDateTime = (value: DateInput) => inAppTz(value).format('D MMM YYYY HH:mm');

/** `Date` lokal (tanpa jam) ↔ string kalender untuk komponen Calendar. */
export const dateToString = (date: Date) => dayjs(date).format(DATE_FORMAT);
export const stringToDate = (date: string) => dayjs(date, DATE_FORMAT).toDate();

/** Hari ini menurut zona aplikasi (`YYYY-MM-DD`). */
export const todayString = () => inAppTz().format(DATE_FORMAT);

/** 545 → "9 j 5 m"; 45 → "45 m"; 0 → "0 m". */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} m`;
  return rest === 0 ? `${hours} j` : `${hours} j ${rest} m`;
}

/** Durasi ms → "H:MM:SS" (stopwatch). */
export function formatClockDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Bulan sebelumnya/berikutnya dari `YYYY-MM`. */
export const shiftMonth = (month: string, delta: number) =>
  dayjs(month, MONTH_FORMAT).add(delta, 'month').format(MONTH_FORMAT);

/** `'2026-10-15'` → "Kam, 15 Okt". */
export const formatDayShort = (date: string) => dayjs(date, DATE_FORMAT).format('ddd, D MMM');

/** ISO weekday (1=Senin … 7=Minggu) dari tanggal kalender. */
export const isoWeekdayOf = (date: string) => {
  const day = dayjs(date, DATE_FORMAT).day();
  return day === 0 ? 7 : day;
};

/** Semua tanggal `YYYY-MM-DD` dalam bulan. */
export function datesInMonth(month: string): string[] {
  const start = dayjs(month, MONTH_FORMAT);
  return Array.from({ length: start.daysInMonth() }, (_, index) =>
    start.add(index, 'day').format(DATE_FORMAT),
  );
}

/** Waktu relatif berbahasa Indonesia, mis. "2 menit yang lalu". */
export const formatRelative = (value: DateInput, now?: DateInput) =>
  now === undefined ? dayjs(value).fromNow() : dayjs(value).from(dayjs(now));

export { dayjs };
