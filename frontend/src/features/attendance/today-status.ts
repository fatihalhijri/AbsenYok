import type { Attendance, LeaveType, MyToday } from '@/types';

/**
 * Kondisi kartu "Status Hari Ini". Diturunkan dari respons `/attendance/me/today` saja (tanpa jam
 * berjalan) — waktu live hanya dihitung di komponen kecil (hitung mundur/durasi).
 */
export type TodayState =
  /** Sudah absen masuk & pulang. */
  | { kind: 'checked-out'; attendance: Attendance }
  /** Sudah masuk, belum pulang. `checkOutAt` = kapan absen pulang tersedia (jeda minimal). */
  | {
      kind: 'checked-in';
      attendance: Attendance;
      canCheckOut: boolean;
      checkOutAvailableAt: string | null;
    }
  /** Cuti/sakit/izin disetujui untuk hari ini. */
  | { kind: 'on-leave'; leaveType: LeaveType | null }
  | { kind: 'holiday'; name: string }
  | { kind: 'non-working-day' }
  | { kind: 'no-shift' }
  /** Jendela absen masuk terbuka. */
  | { kind: 'ready'; closesAt: string | null }
  /** Belum dibuka — tampilkan hitung mundur ke `opensAt`. */
  | { kind: 'not-open'; opensAt: string }
  /** Jendela masuk sudah lewat tanpa absen (atau sudah ditandai alpa). */
  | { kind: 'missed'; closesAt: string | null; absent: boolean };

const LEAVE_STATUS_TO_TYPE: Partial<Record<Attendance['status'], LeaveType>> = {
  SICK: 'SICK',
  PERMIT: 'PERMIT',
  LEAVE: 'ANNUAL',
};

export function deriveTodayState(today: MyToday): TodayState {
  const { attendance } = today;

  // Sudah absen → status absen yang menentukan, walau kemudian ada izin/libur (bisa tetap pulang).
  if (attendance?.checkOutAt) return { kind: 'checked-out', attendance };
  if (attendance?.checkInAt) {
    return {
      kind: 'checked-in',
      attendance,
      canCheckOut: today.canCheckOut,
      checkOutAvailableAt: today.checkOutAvailableAt ?? null,
    };
  }

  if (today.leave) return { kind: 'on-leave', leaveType: today.leave.type };
  const leaveFromRecord = attendance ? LEAVE_STATUS_TO_TYPE[attendance.status] : undefined;
  if (leaveFromRecord) return { kind: 'on-leave', leaveType: leaveFromRecord };
  if (today.holiday) return { kind: 'holiday', name: today.holiday.name };
  if (!today.shift) return { kind: 'no-shift' };
  if (!today.isWorkingDay) return { kind: 'non-working-day' };

  if (today.canCheckIn) return { kind: 'ready', closesAt: today.checkInClosesAt ?? null };

  const serverNow = Date.parse(today.serverTime);
  if (today.checkInOpensAt && serverNow < Date.parse(today.checkInOpensAt)) {
    return { kind: 'not-open', opensAt: today.checkInOpensAt };
  }
  return {
    kind: 'missed',
    closesAt: today.checkInClosesAt ?? null,
    absent: attendance?.status === 'ABSENT',
  };
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  SICK: 'Sakit',
  PERMIT: 'Izin',
  ANNUAL: 'Cuti tahunan',
};

export const METHOD_LABELS: Record<NonNullable<Attendance['checkInMethod']>, string> = {
  KIOSK_QR: 'Scan kiosk',
  PERSONAL_QR: 'QR personal (petugas)',
  MANUAL: 'Input manual admin',
};
