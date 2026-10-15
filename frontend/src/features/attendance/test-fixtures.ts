import type { Attendance, MyToday } from '@/types';

/** Data uji `/attendance/me/today` — 12 Okt 2026 (Senin), shift Reguler 08:00–17:00 WIB. */

export const SHIFT = {
  id: '6f1c2c1e-0000-4000-8000-000000000001',
  name: 'Reguler',
  startTime: '08:00',
  endTime: '17:00',
  lateToleranceMinutes: 15,
  checkInOpenMinutes: 60,
  workDays: '1,2,3,4,5',
} satisfies NonNullable<MyToday['shift']>;

export function makeAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: '6f1c2c1e-0000-4000-8000-0000000000a1',
    date: '2026-10-12',
    status: 'PRESENT',
    checkInAt: null,
    checkOutAt: null,
    checkInMethod: null,
    checkOutMethod: null,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    workMinutes: 0,
    note: null,
    kioskId: null,
    locationId: null,
    kiosk: null,
    location: null,
    ...overrides,
  };
}

export function makeToday(overrides: Partial<MyToday> = {}): MyToday {
  return {
    date: '2026-10-12',
    serverTime: '2026-10-12T00:30:00.000Z', // 07:30 WIB
    attendance: null,
    shift: SHIFT,
    isWorkingDay: true,
    holiday: null,
    leave: null,
    canCheckIn: true,
    canCheckOut: false,
    checkInOpensAt: '2026-10-12T00:00:00.000Z', // 07:00 WIB
    checkInClosesAt: '2026-10-12T10:00:00.000Z', // 17:00 WIB
    checkOutAvailableAt: null,
    ...overrides,
  };
}

/** Sudah absen masuk 08:05 WIB (terlambat 0 karena toleransi). */
export const CHECKED_IN = makeAttendance({
  checkInAt: '2026-10-12T01:05:00.000Z',
  checkInMethod: 'KIOSK_QR',
});
