import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/id';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { env } from '@/lib/env';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
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

export { dayjs };
