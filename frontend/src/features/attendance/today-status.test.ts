import { describe, expect, it } from 'vitest';
import { CHECKED_IN, makeAttendance, makeToday } from './test-fixtures';
import { deriveTodayState } from './today-status';

const LEAVE = {
  id: '6f1c2c1e-0000-4000-8000-0000000000b1',
  type: 'SICK' as const,
  startDate: '2026-10-12',
  endDate: '2026-10-13',
};
const HOLIDAY = {
  id: '6f1c2c1e-0000-4000-8000-0000000000c1',
  date: '2026-10-12',
  name: 'Cuti Bersama',
};

describe('deriveTodayState', () => {
  it('ready: jendela absen masuk terbuka', () => {
    expect(deriveTodayState(makeToday())).toEqual({
      kind: 'ready',
      closesAt: '2026-10-12T10:00:00.000Z',
    });
  });

  it('not-open: sebelum jendela dibuka → hitung mundur ke opensAt', () => {
    const state = deriveTodayState(
      makeToday({ canCheckIn: false, serverTime: '2026-10-11T23:30:00.000Z' }),
    );
    expect(state).toEqual({ kind: 'not-open', opensAt: '2026-10-12T00:00:00.000Z' });
  });

  it('missed: jendela sudah tutup tanpa absen', () => {
    const state = deriveTodayState(
      makeToday({ canCheckIn: false, serverTime: '2026-10-12T11:00:00.000Z' }),
    );
    expect(state).toEqual({ kind: 'missed', closesAt: '2026-10-12T10:00:00.000Z', absent: false });
  });

  it('missed (absent): sudah ditandai alpa oleh cron', () => {
    const state = deriveTodayState(
      makeToday({
        canCheckIn: false,
        serverTime: '2026-10-12T16:00:00.000Z',
        attendance: makeAttendance({ status: 'ABSENT' }),
      }),
    );
    expect(state).toMatchObject({ kind: 'missed', absent: true });
  });

  it('checked-in: sudah masuk, absen pulang belum tersedia', () => {
    const state = deriveTodayState(
      makeToday({
        canCheckIn: false,
        attendance: CHECKED_IN,
        checkOutAvailableAt: '2026-10-12T02:05:00.000Z',
      }),
    );
    expect(state).toEqual({
      kind: 'checked-in',
      attendance: CHECKED_IN,
      canCheckOut: false,
      checkOutAvailableAt: '2026-10-12T02:05:00.000Z',
    });
  });

  it('checked-in: absen pulang sudah bisa', () => {
    const state = deriveTodayState(
      makeToday({ canCheckIn: false, canCheckOut: true, attendance: CHECKED_IN }),
    );
    expect(state).toMatchObject({
      kind: 'checked-in',
      canCheckOut: true,
      checkOutAvailableAt: null,
    });
  });

  it('checked-out: sudah masuk & pulang — menang atas libur/izin', () => {
    const attendance = makeAttendance({
      checkInAt: '2026-10-12T01:00:00.000Z',
      checkOutAt: '2026-10-12T10:00:00.000Z',
      workMinutes: 540,
    });
    const state = deriveTodayState(
      makeToday({ canCheckIn: false, attendance, holiday: HOLIDAY, leave: LEAVE }),
    );
    expect(state).toEqual({ kind: 'checked-out', attendance });
  });

  it('on-leave: pengajuan disetujui untuk hari ini', () => {
    const state = deriveTodayState(makeToday({ canCheckIn: false, leave: LEAVE }));
    expect(state).toEqual({ kind: 'on-leave', leaveType: 'SICK' });
  });

  it('on-leave: dari status record (LEAVE → cuti tahunan) bila data izin tidak ada', () => {
    const state = deriveTodayState(
      makeToday({ canCheckIn: false, attendance: makeAttendance({ status: 'LEAVE' }) }),
    );
    expect(state).toEqual({ kind: 'on-leave', leaveType: 'ANNUAL' });
  });

  it('holiday: hari libur nasional/kantor', () => {
    const state = deriveTodayState(
      makeToday({ canCheckIn: false, isWorkingDay: false, holiday: HOLIDAY }),
    );
    expect(state).toEqual({ kind: 'holiday', name: 'Cuti Bersama' });
  });

  it('non-working-day: bukan hari kerja shift', () => {
    const state = deriveTodayState(
      makeToday({
        date: '2026-10-11',
        canCheckIn: false,
        isWorkingDay: false,
        checkInOpensAt: null,
        checkInClosesAt: null,
      }),
    );
    expect(state).toEqual({ kind: 'non-working-day' });
  });

  it('no-shift: akun belum punya shift', () => {
    const state = deriveTodayState(
      makeToday({
        shift: null,
        canCheckIn: false,
        isWorkingDay: false,
        checkInOpensAt: null,
        checkInClosesAt: null,
      }),
    );
    expect(state).toEqual({ kind: 'no-shift' });
  });
});
