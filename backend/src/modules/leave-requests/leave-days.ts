import { type DateRange, eachDate } from '@/common/utils/date-range.util';
import { isoWeekday } from '@/common/utils/date.util';

/**
 * Hari kerja dalam rentang (inklusif): sesuai `workDays` shift (ISO 1=Senin … 7=Minggu)
 * dan bukan hari libur. Dipakai untuk `totalDays` pengajuan izin/cuti (§9).
 */
export function listWorkingDays(
  range: DateRange,
  workDays: number[],
  holidays: Set<string>,
): string[] {
  return eachDate(range).filter(
    (date) => workDays.includes(isoWeekday(date)) && !holidays.has(date),
  );
}

export function countWorkingDays(
  range: DateRange,
  workDays: number[],
  holidays: Set<string>,
): number {
  return listWorkingDays(range, workDays, holidays).length;
}
