import { DATE_FORMAT, dayjs, isoWeekdayOf } from './date';

/** `"1,2,3,4,5"` (ISO weekday, Senin=1) → `[1,2,3,4,5]`; nilai rusak diabaikan. */
export function parseWorkDays(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
}

/** Semua tanggal `YYYY-MM-DD` dari `from` s.d. `to` (inklusif); kosong bila terbalik. */
export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  const end = dayjs(to, DATE_FORMAT);
  for (let day = dayjs(from, DATE_FORMAT); !day.isAfter(end, 'day'); day = day.add(1, 'day')) {
    dates.push(day.format(DATE_FORMAT));
  }
  return dates;
}

/**
 * Estimasi hari kerja dalam rentang (inklusif): hari sesuai `workDays` shift dan bukan hari
 * libur — sama dengan aturan backend (`countWorkingDays`), tetapi tetap divalidasi server.
 */
export function countWorkingDays(
  from: string,
  to: string,
  workDays: number[],
  holidays: ReadonlySet<string>,
): number {
  return datesBetween(from, to).filter(
    (date) => workDays.includes(isoWeekdayOf(date)) && !holidays.has(date),
  ).length;
}
