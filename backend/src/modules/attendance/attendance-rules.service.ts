import { Injectable } from '@nestjs/common';
import {
  combineDateAndTime,
  diffMinutes,
  formatLocalTime,
  isoWeekday,
} from '@/common/utils/date.util';
import { parseWorkDays } from '@/common/utils/time.util';

const MINUTE_MS = 60_000;

/** Aturan shift yang dipakai perhitungan (sama dengan isi `shiftSnapshot`). */
export interface ShiftRule {
  name: string;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  checkInOpenMinutes: number;
  workDays: string;
}

export type ScanAction = 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_CHECKED_OUT';
export type CheckInWindowState = 'OPEN' | 'NOT_YET_OPEN' | 'CLOSED';

export interface CheckInWindow {
  opensAt: Date;
  /** Menit terakhir yang masih diterima (HH:mm == endTime). */
  closesAt: Date;
}

export interface CheckInStatus {
  status: 'PRESENT' | 'LATE';
  lateMinutes: number;
}

export interface CheckOutMetrics {
  earlyLeaveMinutes: number;
  workMinutes: number;
}

/**
 * Aturan absensi murni (BUSINESS-RULES §3–§6) — tanpa database, mudah di-test.
 * Semua jam shift adalah jam lokal APP_TIMEZONE pada tanggal `date` (YYYY-MM-DD).
 */
@Injectable()
export class AttendanceRulesService {
  /** §6: hari ISO tanggal tersebut termasuk `workDays` shift. */
  isWorkingDay(shift: Pick<ShiftRule, 'workDays'>, date: string): boolean {
    return parseWorkDays(shift.workDays)?.includes(isoWeekday(date)) ?? false;
  }

  /** §3: belum ada check-in → CHECK_IN; sudah masuk belum pulang → CHECK_OUT; sudah pulang → tolak. */
  resolveAction(
    attendance: { checkInAt: Date | null; checkOutAt: Date | null } | null,
  ): ScanAction {
    if (!attendance?.checkInAt) return 'CHECK_IN';
    if (!attendance.checkOutAt) return 'CHECK_OUT';
    return 'ALREADY_CHECKED_OUT';
  }

  /** §4: dibuka `startTime − checkInOpenMinutes`, ditutup setelah menit `endTime`. */
  checkInWindow(shift: ShiftRule, date: string): CheckInWindow {
    const start = combineDateAndTime(date, shift.startTime);
    return {
      opensAt: new Date(start.getTime() - shift.checkInOpenMinutes * MINUTE_MS),
      closesAt: combineDateAndTime(date, shift.endTime),
    };
  }

  checkInWindowState(shift: ShiftRule, date: string, now: Date): CheckInWindowState {
    const { opensAt, closesAt } = this.checkInWindow(shift, date);
    if (now < opensAt) return 'NOT_YET_OPEN';
    // Presisi menit: seluruh menit endTime (mis. 17:00:00–17:00:59) masih diterima.
    if (now.getTime() >= closesAt.getTime() + MINUTE_MS) return 'CLOSED';
    return 'OPEN';
  }

  isWithinCheckInWindow(shift: ShiftRule, date: string, now: Date): boolean {
    return this.checkInWindowState(shift, date, now) === 'OPEN';
  }

  /**
   * §5: PRESENT bila terlambat ≤ toleransi (presisi menit, dibulatkan ke bawah).
   * LATE → `lateMinutes` dihitung dari `startTime`, bukan dari batas toleransi.
   */
  computeCheckInStatus(shift: ShiftRule, date: string, checkInAt: Date): CheckInStatus {
    const lateBy = diffMinutes(checkInAt, combineDateAndTime(date, shift.startTime));
    return lateBy > shift.lateToleranceMinutes
      ? { status: 'LATE', lateMinutes: lateBy }
      : { status: 'PRESENT', lateMinutes: 0 };
  }

  /** §5: pulang cepat = endTime − checkOut (min 0); lama kerja = checkOut − checkIn. */
  computeCheckOutMetrics(
    shift: ShiftRule,
    date: string,
    checkInAt: Date,
    checkOutAt: Date,
  ): CheckOutMetrics {
    return {
      earlyLeaveMinutes: Math.max(
        0,
        diffMinutes(combineDateAndTime(date, shift.endTime), checkOutAt),
      ),
      workMinutes: Math.max(0, diffMinutes(checkOutAt, checkInAt)),
    };
  }

  /** §4: absen pulang paling cepat `minGapMinutes` setelah check-in. */
  checkOutAvailableAt(checkInAt: Date, minGapMinutes: number): Date {
    return new Date(checkInAt.getTime() + minGapMinutes * MINUTE_MS);
  }

  checkInMessage(checkInAt: Date, { status, lateMinutes }: CheckInStatus): string {
    const base = `Absen masuk berhasil pukul ${formatLocalTime(checkInAt)}.`;
    return status === 'LATE'
      ? `${base} Anda terlambat ${formatDuration(lateMinutes)}.`
      : `${base} Selamat bekerja!`;
  }

  checkOutMessage(checkOutAt: Date, { earlyLeaveMinutes, workMinutes }: CheckOutMetrics): string {
    const parts = [`Absen pulang berhasil pukul ${formatLocalTime(checkOutAt)}.`];
    if (earlyLeaveMinutes > 0) {
      parts.push(`Anda pulang ${formatDuration(earlyLeaveMinutes)} lebih awal.`);
    }
    parts.push(`Total kerja ${formatDuration(workMinutes)}.`);
    return parts.join(' ');
  }
}

/** 553 → "9 jam 13 menit", 45 → "45 menit", 480 → "8 jam", 0 → "0 menit". */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} menit`;
  return minutes === 0 ? `${hours} jam` : `${hours} jam ${minutes} menit`;
}
