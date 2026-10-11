import {
  DEFAULT_TIMEZONE,
  addDays,
  combineDateAndTime,
  diffMinutes,
  fromDbDate,
  getAppTimezone,
  isoWeekday,
  nowInTz,
  setAppTimezone,
  toDbDate,
  toTzDateString,
  todayDate,
  todayDateString,
} from '@/common/utils/date.util';

describe('date.util (APP_TIMEZONE = Asia/Jakarta, UTC+7)', () => {
  beforeAll(() => setAppTimezone('Asia/Jakarta'));

  afterEach(() => {
    jest.useRealTimers();
    setAppTimezone('Asia/Jakarta');
  });

  const freezeAt = (iso: string) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(iso));
  };

  describe('pergantian hari pukul 00:00 WIB (17:00 UTC)', () => {
    it('23:59:59.999 WIB masih tanggal yang sama', () => {
      freezeAt('2026-10-11T16:59:59.999Z');
      expect(todayDateString()).toBe('2026-10-11');
      expect(nowInTz().format('YYYY-MM-DD HH:mm:ss')).toBe('2026-10-11 23:59:59');
    });

    it('00:00 WIB sudah berganti ke tanggal berikutnya walau UTC masih tanggal lama', () => {
      freezeAt('2026-10-11T17:00:00.000Z');
      expect(todayDateString()).toBe('2026-10-12');
      expect(nowInTz().format('YYYY-MM-DD HH:mm')).toBe('2026-10-12 00:00');
    });

    it('07:00 WIB = 00:00 UTC pada tanggal yang sama', () => {
      freezeAt('2026-10-12T00:00:00.000Z');
      expect(todayDateString()).toBe('2026-10-12');
      expect(nowInTz().hour()).toBe(7);
    });

    it('todayDate() mengembalikan tanggal lokal sebagai UTC 00:00 (kolom @db.Date)', () => {
      freezeAt('2026-10-11T17:30:00.000Z'); // 12 Okt 00:30 WIB
      expect(todayDate().toISOString()).toBe('2026-10-12T00:00:00.000Z');
    });

    it('toTzDateString() memakai tanggal lokal dari sebuah instant', () => {
      expect(toTzDateString(new Date('2026-10-11T16:59:00Z'))).toBe('2026-10-11');
      expect(toTzDateString(new Date('2026-10-11T17:01:00Z'))).toBe('2026-10-12');
    });
  });

  describe('nowInTz()', () => {
    it('ber-offset +07:00', () => {
      freezeAt('2026-10-11T01:05:22.000Z');
      const now = nowInTz();
      expect(now.utcOffset()).toBe(420);
      expect(now.format()).toBe('2026-10-11T08:05:22+07:00');
      expect(now.toDate().toISOString()).toBe('2026-10-11T01:05:22.000Z');
    });
  });

  describe('toDbDate() / fromDbDate()', () => {
    it('mengubah tanggal kalender ke Date UTC 00:00', () => {
      expect(toDbDate('2026-10-12').toISOString()).toBe('2026-10-12T00:00:00.000Z');
    });

    it('fromDbDate() adalah kebalikan toDbDate()', () => {
      expect(fromDbDate(toDbDate('2026-02-28'))).toBe('2026-02-28');
    });

    it.each(['2026-13-01', '2026-02-30', '12-10-2026', '2026-1-5', ''])(
      'menolak tanggal tidak valid "%s"',
      (value) => {
        expect(() => toDbDate(value)).toThrow(RangeError);
      },
    );
  });

  describe('addDays()', () => {
    it.each([
      ['2026-10-31', 1, '2026-11-01'],
      ['2026-12-31', 1, '2027-01-01'],
      ['2026-03-01', -1, '2026-02-28'],
      ['2028-02-28', 1, '2028-02-29'],
      ['2026-10-12', -30, '2026-09-12'],
    ])('%s %+d hari → %s', (date, days, expected) => {
      expect(addDays(date, days)).toBe(expected);
    });

    it('menolak tanggal tidak valid', () => {
      expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
    });
  });

  describe('combineDateAndTime() — jam lokal Jakarta → UTC', () => {
    it.each([
      ['2026-10-12', '08:00', '2026-10-12T01:00:00.000Z'],
      ['2026-10-12', '17:00', '2026-10-12T10:00:00.000Z'],
      ['2026-10-12', '00:00', '2026-10-11T17:00:00.000Z'],
      ['2026-10-12', '06:59', '2026-10-11T23:59:00.000Z'],
      ['2026-10-12', '23:59', '2026-10-12T16:59:00.000Z'],
      ['2026-12-31', '23:30', '2026-12-31T16:30:00.000Z'],
    ])('%s %s WIB → %s', (date, time, expected) => {
      expect(combineDateAndTime(date, time).toISOString()).toBe(expected);
    });

    it.each(['24:00', '8:00', '08:60', '0800'])('menolak jam tidak valid "%s"', (time) => {
      expect(() => combineDateAndTime('2026-10-12', time)).toThrow(RangeError);
    });

    it('mengikuti APP_TIMEZONE yang dikonfigurasi', () => {
      setAppTimezone('Asia/Makassar'); // WITA, UTC+8
      expect(combineDateAndTime('2026-10-12', '08:00').toISOString()).toBe(
        '2026-10-12T00:00:00.000Z',
      );
    });
  });

  describe('isoWeekday()', () => {
    it('tanggal kalender: Senin = 1, Minggu = 7', () => {
      expect(isoWeekday('2026-10-12')).toBe(1);
      expect(isoWeekday('2026-10-11')).toBe(7);
    });

    it('instant dihitung menurut zona Jakarta', () => {
      expect(isoWeekday(new Date('2026-10-11T16:59:59Z'))).toBe(7); // Minggu 23:59 WIB
      expect(isoWeekday(new Date('2026-10-11T17:00:00Z'))).toBe(1); // Senin 00:00 WIB
    });

    it('tanpa argumen memakai hari ini di Jakarta', () => {
      freezeAt('2026-10-11T17:00:00.000Z');
      expect(isoWeekday()).toBe(1);
    });
  });

  describe('diffMinutes()', () => {
    const start = new Date('2026-10-12T01:00:00Z'); // 08:00 WIB

    it('menghitung selisih menit dan mengabaikan sisa detik', () => {
      expect(diffMinutes(new Date('2026-10-12T01:07:59Z'), start)).toBe(7);
      expect(diffMinutes(new Date('2026-10-12T01:00:59Z'), start)).toBe(0);
      expect(diffMinutes(new Date('2026-10-12T10:00:00Z'), start)).toBe(540);
    });

    it('bernilai negatif bila urutan terbalik', () => {
      expect(diffMinutes(start, new Date('2026-10-12T01:30:00Z'))).toBe(-30);
    });
  });

  describe('setAppTimezone()', () => {
    it('menolak zona waktu tidak dikenal', () => {
      expect(() => setAppTimezone('Mars/Olympus')).toThrow(RangeError);
      expect(getAppTimezone()).toBe(DEFAULT_TIMEZONE);
    });
  });
});
