import { durationToSeconds } from '@/common/utils/duration.util';

describe('durationToSeconds()', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['2h', 7_200],
    ['7d', 604_800],
  ])('%s → %d detik', (input, expected) => {
    expect(durationToSeconds(input)).toBe(expected);
  });

  it.each(['15', '15 m', '1w', '', 'm15'])('menolak "%s"', (input) => {
    expect(() => durationToSeconds(input)).toThrow(RangeError);
  });
});
