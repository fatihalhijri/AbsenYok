import { formatWorkDays, parseWorkDays, timeToMinutes } from '@/common/utils/time.util';
import { validateShiftTiming } from '@/modules/shifts/shift-rules';

describe('time.util', () => {
  it.each([
    ['00:00', 0],
    ['08:30', 510],
    ['23:59', 1_439],
  ])('timeToMinutes(%s) → %d', (time, minutes) => {
    expect(timeToMinutes(time)).toBe(minutes);
  });

  it('timeToMinutes menolak format salah', () => {
    expect(() => timeToMinutes('8:30')).toThrow(RangeError);
  });

  it.each([
    ['1,2,3,4,5', [1, 2, 3, 4, 5]],
    ['5,1,3', [1, 3, 5]],
    [' 6 , 7 ', [6, 7]],
    ['7', [7]],
  ])('parseWorkDays(%s) → %j', (input, expected) => {
    expect(parseWorkDays(input)).toEqual(expected);
  });

  it.each(['', '0', '8', '1,1', '1,,2', 'Senin', '1;2'])('parseWorkDays menolak "%s"', (input) => {
    expect(parseWorkDays(input)).toBeNull();
  });

  it('formatWorkDays mengurutkan', () => {
    expect(formatWorkDays([5, 1, 3])).toBe('1,3,5');
  });
});

describe('validateShiftTiming()', () => {
  const base = {
    startTime: '08:00',
    endTime: '17:00',
    checkInOpenMinutes: 60,
    workDays: '1,2,3,4,5',
  };

  it('shift valid → tanpa error, workDays dinormalisasi', () => {
    expect(validateShiftTiming({ ...base, workDays: '5,4,3,2,1' })).toEqual({
      errors: [],
      workDays: '1,2,3,4,5',
    });
  });

  it.each([
    ['sama dengan jam masuk', '08:00'],
    ['sebelum jam masuk (lintas tengah malam)', '06:00'],
  ])('jam pulang %s → error endTime', (_label, endTime) => {
    const { errors } = validateShiftTiming({ ...base, endTime });
    expect(errors.map((e) => e.field)).toEqual(['endTime']);
  });

  it('jendela absen tidak boleh dimulai sebelum 00:00', () => {
    const { errors } = validateShiftTiming({ ...base, startTime: '00:30', checkInOpenMinutes: 60 });
    expect(errors.map((e) => e.field)).toEqual(['checkInOpenMinutes']);
  });

  it('workDays tidak valid dilaporkan bersama error lain', () => {
    const { errors } = validateShiftTiming({ ...base, endTime: '07:00', workDays: '1,8' });
    expect(errors.map((e) => e.field).sort()).toEqual(['endTime', 'workDays']);
  });
});
