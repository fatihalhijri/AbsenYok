import { setAppTimezone } from '@/common/utils/date.util';
import {
  AttendanceRulesService,
  formatDuration,
  type ShiftRule,
} from '@/modules/attendance/attendance-rules.service';

/** Shift Reguler Sen–Jum 08:00–17:00, toleransi 15 menit, absen dibuka 60 menit sebelumnya. */
const SHIFT: ShiftRule = {
  name: 'Reguler',
  startTime: '08:00',
  endTime: '17:00',
  lateToleranceMinutes: 15,
  checkInOpenMinutes: 60,
  workDays: '1,2,3,4,5',
};

const MONDAY = '2026-10-12';
const SATURDAY = '2026-10-17';
/** Jam lokal WIB (UTC+7) pada hari Senin. */
const wib = (time: string) => new Date(`${MONDAY}T${time}+07:00`);

describe('AttendanceRulesService', () => {
  const rules = new AttendanceRulesService();

  beforeAll(() => setAppTimezone('Asia/Jakarta'));

  describe('computeCheckInStatus (§5)', () => {
    it.each([
      ['datang lebih awal', '07:42:10', 'PRESENT', 0],
      ['tepat waktu', '08:00:00', 'PRESENT', 0],
      ['dalam toleransi', '08:09:30', 'PRESENT', 0],
      ['tepat di batas toleransi (masih PRESENT)', '08:15:00', 'PRESENT', 0],
      ['detik terakhir menit batas toleransi (masih PRESENT)', '08:15:59', 'PRESENT', 0],
      ['1 menit lewat toleransi → LATE, dihitung dari startTime', '08:16:00', 'LATE', 16],
      ['terlambat 22 menit', '08:22:45', 'LATE', 22],
    ] as const)('%s (%s) → %s', (_label, time, status, lateMinutes) => {
      expect(rules.computeCheckInStatus(SHIFT, MONDAY, wib(time))).toEqual({ status, lateMinutes });
    });
  });

  describe('jendela absen masuk (§4)', () => {
    it.each([
      ['sebelum jendela dibuka (06:59)', '06:59:59', 'NOT_YET_OPEN'],
      ['tepat saat dibuka (07:00)', '07:00:00', 'OPEN'],
      ['tengah hari', '12:00:00', 'OPEN'],
      ['menit terakhir jam pulang (17:00:59)', '17:00:59', 'OPEN'],
      ['setelah endTime (17:01)', '17:01:00', 'CLOSED'],
    ] as const)('%s → %s', (_label, time, state) => {
      expect(rules.checkInWindowState(SHIFT, MONDAY, wib(time))).toBe(state);
      expect(rules.isWithinCheckInWindow(SHIFT, MONDAY, wib(time))).toBe(state === 'OPEN');
    });

    it('checkInWindow dalam UTC', () => {
      const { opensAt, closesAt } = rules.checkInWindow(SHIFT, MONDAY);
      expect(opensAt.toISOString()).toBe('2026-10-12T00:00:00.000Z');
      expect(closesAt.toISOString()).toBe('2026-10-12T10:00:00.000Z');
    });
  });

  describe('checkout (§4–§5)', () => {
    const checkIn = wib('07:52:00');

    it('checkout terlalu cepat: tersedia 5 menit setelah check-in', () => {
      const availableAt = rules.checkOutAvailableAt(checkIn, 5);
      expect(availableAt.toISOString()).toBe(wib('07:57:00').toISOString());
      expect(wib('07:56:59') < availableAt).toBe(true);
      expect(wib('07:57:00') < availableAt).toBe(false);
    });

    it('pulang tepat/lebih lambat: earlyLeave 0, workMinutes dihitung', () => {
      expect(rules.computeCheckOutMetrics(SHIFT, MONDAY, checkIn, wib('17:05:30'))).toEqual({
        earlyLeaveMinutes: 0,
        workMinutes: 553,
      });
    });

    it('pulang cepat: earlyLeave = endTime − checkOut', () => {
      expect(rules.computeCheckOutMetrics(SHIFT, MONDAY, checkIn, wib('16:30:00'))).toEqual({
        earlyLeaveMinutes: 30,
        workMinutes: 518,
      });
    });
  });

  describe('isWorkingDay (§6)', () => {
    it('Senin termasuk shift Sen–Jum', () => {
      expect(rules.isWorkingDay(SHIFT, MONDAY)).toBe(true);
    });

    it('hari Sabtu untuk shift Sen–Jum → bukan hari kerja', () => {
      expect(rules.isWorkingDay(SHIFT, SATURDAY)).toBe(false);
      expect(rules.isWorkingDay({ workDays: '1,2,3,4,5,6' }, SATURDAY)).toBe(true);
    });

    it('workDays rusak → bukan hari kerja (aman)', () => {
      expect(rules.isWorkingDay({ workDays: 'Senin' }, MONDAY)).toBe(false);
    });
  });

  describe('resolveAction (§3)', () => {
    it.each([
      ['belum ada record', null, 'CHECK_IN'],
      [
        'record tanpa check-in (mis. ABSENT buatan admin)',
        { checkInAt: null, checkOutAt: null },
        'CHECK_IN',
      ],
      ['sudah masuk, belum pulang', { checkInAt: wib('07:52:00'), checkOutAt: null }, 'CHECK_OUT'],
      [
        'sudah pulang',
        { checkInAt: wib('07:52:00'), checkOutAt: wib('17:05:00') },
        'ALREADY_CHECKED_OUT',
      ],
    ] as const)('%s → %s', (_label, attendance, action) => {
      expect(rules.resolveAction(attendance)).toBe(action);
    });
  });

  describe('pesan ScanResult', () => {
    it('masuk tepat waktu', () => {
      expect(rules.checkInMessage(wib('07:52:10'), { status: 'PRESENT', lateMinutes: 0 })).toBe(
        'Absen masuk berhasil pukul 07:52. Selamat bekerja!',
      );
    });

    it('masuk terlambat', () => {
      expect(rules.checkInMessage(wib('08:22:00'), { status: 'LATE', lateMinutes: 22 })).toBe(
        'Absen masuk berhasil pukul 08:22. Anda terlambat 22 menit.',
      );
    });

    it('pulang dengan total kerja', () => {
      expect(
        rules.checkOutMessage(wib('17:05:00'), { earlyLeaveMinutes: 0, workMinutes: 553 }),
      ).toBe('Absen pulang berhasil pukul 17:05. Total kerja 9 jam 13 menit.');
    });

    it('pulang cepat', () => {
      expect(
        rules.checkOutMessage(wib('16:30:00'), { earlyLeaveMinutes: 30, workMinutes: 518 }),
      ).toBe(
        'Absen pulang berhasil pukul 16:30. Anda pulang 30 menit lebih awal. Total kerja 8 jam 38 menit.',
      );
    });

    it.each([
      [0, '0 menit'],
      [45, '45 menit'],
      [60, '1 jam'],
      [553, '9 jam 13 menit'],
    ])('formatDuration(%d) → %s', (minutes, text) => {
      expect(formatDuration(minutes)).toBe(text);
    });
  });
});
