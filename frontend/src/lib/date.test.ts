import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  datesInMonth,
  daysInclusive,
  formatClockDuration,
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatDayShort,
  formatMinutes,
  formatMonth,
  formatTime,
  isoWeekdayOf,
  shiftMonth,
  toDateString,
  todayString,
} from './date';

afterEach(() => vi.useRealTimers());

describe('format tanggal & jam (zona Asia/Jakarta, locale id)', () => {
  it('tanggal kalender tidak digeser zona', () => {
    expect(formatDateLong('2026-10-12')).toBe('Senin, 12 Oktober 2026');
    expect(formatDateShort('2026-10-12')).toBe('12 Okt 2026');
    expect(formatDayShort('2026-10-15')).toBe('Kam, 15 Okt');
    expect(formatMonth('2026-10')).toBe('Oktober 2026');
  });

  it('instant UTC → jam & tanggal lokal (24 jam)', () => {
    expect(formatTime('2026-10-12T01:05:00.000Z')).toBe('08:05');
    expect(formatTime('2026-10-12T13:30:00.000Z')).toBe('20:30');
    expect(formatDateTime('2026-10-12T01:05:00.000Z')).toBe('12 Okt 2026 08:05');
    // 17:30 UTC = 00:30 WIB keesokan harinya
    expect(toDateString('2026-10-11T17:30:00.000Z')).toBe('2026-10-12');
  });

  it('hari ini dihitung di zona aplikasi, bukan zona perangkat', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T18:00:00.000Z')); // 01:00 WIB 12 Okt
    expect(todayString()).toBe('2026-10-12');
  });
});

describe('durasi', () => {
  it('formatMinutes', () => {
    expect(formatMinutes(545)).toBe('9 j 5 m');
    expect(formatMinutes(45)).toBe('45 m');
    expect(formatMinutes(120)).toBe('2 j');
    expect(formatMinutes(0)).toBe('0 m');
    expect(formatMinutes(-5)).toBe('0 m');
  });

  it('formatClockDuration (stopwatch)', () => {
    expect(formatClockDuration(3_723_000)).toBe('1:02:03');
    expect(formatClockDuration(-1)).toBe('0:00:00');
  });
});

describe('kalender', () => {
  it('shiftMonth lintas tahun', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('isoWeekdayOf: Senin=1 … Minggu=7', () => {
    expect(isoWeekdayOf('2026-10-12')).toBe(1);
    expect(isoWeekdayOf('2026-10-18')).toBe(7);
  });

  it('datesInMonth termasuk Februari kabisat', () => {
    expect(datesInMonth('2026-10')).toHaveLength(31);
    expect(datesInMonth('2028-02').at(-1)).toBe('2028-02-29');
  });

  it('daysInclusive', () => {
    expect(daysInclusive('2026-10-01', '2026-10-31')).toBe(31);
    expect(daysInclusive('2026-10-12', '2026-10-12')).toBe(1);
    expect(daysInclusive('2026-08-01', '2026-10-31')).toBe(92);
  });
});
