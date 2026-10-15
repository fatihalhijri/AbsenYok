import { fromDbDate } from '@/common/utils/date.util';
import type { Prisma } from '@/generated/prisma/client';

/** Kolom absensi yang dikirim ke client. */
export const ATTENDANCE_SELECT = {
  id: true,
  date: true,
  status: true,
  checkInAt: true,
  checkOutAt: true,
  checkInMethod: true,
  checkOutMethod: true,
  lateMinutes: true,
  earlyLeaveMinutes: true,
  workMinutes: true,
  note: true,
  kioskId: true,
  locationId: true,
  // Nama kiosk/lokasi untuk riwayat karyawan (karyawan tidak punya akses ke /kiosks & /locations).
  kiosk: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  shiftSnapshot: true,
} satisfies Prisma.AttendanceSelect;

export type AttendanceRow = Prisma.AttendanceGetPayload<{ select: typeof ATTENDANCE_SELECT }>;

export type AttendanceView = Omit<AttendanceRow, 'date' | 'shiftSnapshot'> & { date: string };

export function toAttendanceView({
  date,
  shiftSnapshot: _snapshot,
  ...row
}: AttendanceRow): AttendanceView {
  return { ...row, date: fromDbDate(date) };
}
