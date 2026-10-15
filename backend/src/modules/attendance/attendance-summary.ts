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
  /**
   * Hari yang dihitung (penyebut attendanceRate): hari kerja terjadwal yang sudah lewat sejak
   * karyawan bergabung, ditambah hari lain yang punya record (mis. absen manual di akhir pekan).
   */
  workingDays: number;
  /** (present + late) / workingDays × 100, 1 desimal (maks 100). */
  attendanceRate: number;
}

export interface SummaryRecord {
  date: string;
  status: string;
  lateMinutes: number;
  workMinutes: number;
}

export interface SummaryInput {
  records: SummaryRecord[];
  /** ISO weekday hari kerja shift karyawan (null = tanpa shift / shift nonaktif). */
  workDays: number[] | null;
  holidays: Set<string>;
  range: DateRange;
  /** Tanggal lokal hari ini. */
  today: string;
  /** Tanggal lokal akun karyawan dibuat; hari kerja sebelumnya tidak dihitung. */
  joinedOn?: string | null;
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
 * ABSENT pada tanggal yang belakangan ditetapkan sebagai hari libur (cron 23:55 sudah berjalan
 * sebelum libur diinput) bukan ketidakhadiran — record tetap disimpan, tetapi tidak dihitung.
 */
export function isVoidAbsence(record: { date: string; status: string }, holidays: Set<string>) {
  return record.status === 'ABSENT' && holidays.has(record.date);
}

/**
 * Awal periode yang dihitung: sejak karyawan bergabung, atau sejak record pertamanya bila lebih
 * awal (riwayat hasil impor/seed), tetapi tidak sebelum awal rentang.
 */
export function trackingStart(
  range: DateRange,
  joinedOn: string | null | undefined,
  recordDates: Iterable<string>,
): string {
  if (!joinedOn) return range.from;
  let start = joinedOn;
  for (const date of recordDates) if (date < start) start = date;
  return start > range.from ? start : range.from;
}

/**
 * Ringkasan bulanan riwayat karyawan. Hari terjadwal "sudah lewat" = sebelum hari ini, ditambah
 * hari ini bila sudah ada record (agar persentase tidak turun di pagi hari sebelum absen).
 * Setiap tanggal hanya punya satu record per karyawan, sehingga persentase tidak pernah > 100.
 */
export function computeMonthlySummary({
  records,
  workDays,
  holidays,
  range,
  today,
  joinedOn,
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

  const counted = records.filter((record) => !isVoidAbsence(record, holidays));
  for (const record of counted) {
    const key = STATUS_KEYS[record.status as keyof typeof STATUS_KEYS];
    if (key) summary[key] += 1;
    summary.totalLateMinutes += record.lateMinutes;
    summary.totalWorkMinutes += record.workMinutes;
  }

  const recordDates = new Set(counted.map((record) => record.date));
  const countedDays = new Set([...recordDates].filter((date) => date <= today));
  const start = trackingStart(range, joinedOn, recordDates);
  if (workDays && start <= range.to) {
    for (const date of eachDate({ from: start, to: range.to })) {
      const elapsed = date < today || (date === today && recordDates.has(date));
      if (elapsed && workDays.includes(isoWeekday(date)) && !holidays.has(date)) {
        countedDays.add(date);
      }
    }
  }

  summary.workingDays = countedDays.size;
  summary.attendanceRate =
    summary.workingDays === 0
      ? 0
      : Math.round(((summary.present + summary.late) / summary.workingDays) * 1000) / 10;
  return summary;
}
