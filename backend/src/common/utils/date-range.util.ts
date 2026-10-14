import dayjs from 'dayjs';
import { validationError } from '@/common/exceptions/error-factories';
import { addDays, DATE_FORMAT, toDbDate } from './date.util';

export const MAX_RANGE_DAYS = 92;

export interface DateRange {
  /** YYYY-MM-DD (inklusif) */
  from: string;
  /** YYYY-MM-DD (inklusif) */
  to: string;
}

const DAY_MS = 86_400_000;

/** Jumlah hari kalender inklusif: 2026-10-01..2026-10-31 → 31. */
export function daysInclusive(from: string, to: string): number {
  return Math.round((toDbDate(to).getTime() - toDbDate(from).getTime()) / DAY_MS) + 1;
}

/** Semua tanggal kalender dalam rentang inklusif. */
export function eachDate({ from, to }: DateRange): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** `'2026-02'` → `{ from: '2026-02-01', to: '2026-02-28' }`. */
export function monthRange(month: string): DateRange {
  const start = dayjs.utc(`${month}-01`, DATE_FORMAT, true);
  return { from: start.format(DATE_FORMAT), to: start.endOf('month').format(DATE_FORMAT) };
}

/**
 * Filter `dateFrom`/`dateTo` daftar admin. Default: awal bulan `dateTo` s/d `dateTo`
 * (default `dateTo` = hari ini). Maksimal 92 hari agar query tetap ringan.
 */
export function resolveDateRange(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  today: string,
  maxDays: number = MAX_RANGE_DAYS,
): DateRange {
  const to = dateTo ?? today;
  const from = dateFrom ?? `${to.slice(0, 7)}-01`;

  if (from > to) {
    throw validationError([
      { field: 'dateFrom', messages: ['dateFrom tidak boleh setelah dateTo'] },
    ]);
  }
  if (daysInclusive(from, to) > maxDays) {
    throw validationError([
      { field: 'dateTo', messages: [`Rentang tanggal maksimal ${maxDays} hari`] },
    ]);
  }
  return { from, to };
}
