import { type DateRange, eachDate } from '@/common/utils/date-range.util';
import { isoWeekday } from '@/common/utils/date.util';

export interface MonthlySummary {
  present: number;
  late: number;
  absent: number;
  sick: number;
  permit: number;
  leave: number;
  totalLateMinutes: number;
  totalWorkMinutes: number;
  /** Hari kerja yang sudah lewat (penyebut attendanceRate). */
  workingDays: number;
  /** (present + late) / workingDays × 100, 1 desimal. */
  attendanceRate: number;
}

export interface SummaryInput {
  records: { date: string; status: string; lateMinutes: number; workMinutes: number }[];
  /** ISO weekday hari kerja shift karyawan (null = tanpa shift). */
  workDays: number[] | null;
  holidays: Set<string>;
  range: DateRange;
  /** Tanggal lokal hari ini. */
  today: string;
}

const STATUS_KEYS = {
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent',
  SICK: 'sick',
  PERMIT: 'permit',
  LEAVE: 'leave',
} as const;

/**
 * Ringkasan bulanan riwayat karyawan. Hari kerja "sudah lewat" = sebelum hari ini, ditambah
 * hari ini bila sudah ada record (agar persentase tidak turun di pagi hari sebelum absen).
 */
export function computeMonthlySummary({
  records,
  workDays,
  holidays,
  range,
  today,
}: SummaryInput): MonthlySummary {
  const summary: MonthlySummary = {
    present: 0,
    late: 0,
    absent: 0,
    sick: 0,
    permit: 0,
    leave: 0,
    totalLateMinutes: 0,
    totalWorkMinutes: 0,
    workingDays: 0,
    attendanceRate: 0,
  };

  for (const record of records) {
    const key = STATUS_KEYS[record.status as keyof typeof STATUS_KEYS];
    if (key) summary[key] += 1;
    summary.totalLateMinutes += record.lateMinutes;
    summary.totalWorkMinutes += record.workMinutes;
  }

  const recordDates = new Set(records.map((record) => record.date));
  if (workDays) {
    summary.workingDays = eachDate(range).filter(
      (date) =>
        (date < today || (date === today && recordDates.has(date))) &&
        workDays.includes(isoWeekday(date)) &&
        !holidays.has(date),
    ).length;
  }

  summary.attendanceRate =
    summary.workingDays === 0
      ? 0
      : Math.round(((summary.present + summary.late) / summary.workingDays) * 1000) / 10;
  return summary;
}
