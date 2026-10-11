import { omitUndefined } from '@/common/utils/object.util';

describe('omitUndefined()', () => {
  it('membuang undefined, mempertahankan null/false/0/string kosong', () => {
    expect(omitUndefined({ a: undefined, b: null, c: false, d: 0, e: '' })).toEqual({
      b: null,
      c: false,
      d: 0,
      e: '',
    });
  });

  it('mencegah default tertimpa saat spread DTO', () => {
    class Dto {
      workDays?: string = undefined;
      name = 'Pagi';
    }
    const merged = { workDays: '1,2,3,4,5', ...omitUndefined(new Dto()) };
    expect(merged).toEqual({ workDays: '1,2,3,4,5', name: 'Pagi' });
  });
});
