import { paginate, toSkipTake } from '@/common/utils/paginate.util';

describe('paginate.util', () => {
  it('toSkipTake() menghitung offset', () => {
    expect(toSkipTake({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
    expect(toSkipTake({ page: 3, limit: 25 })).toEqual({ skip: 50, take: 25 });
  });

  it('paginate() membentuk meta', () => {
    expect(paginate(['a', 'b'], 45, { page: 3, limit: 20 })).toEqual({
      items: ['a', 'b'],
      meta: { page: 3, limit: 20, total: 45, totalPages: 3 },
    });
  });

  it('totalPages 0 bila tidak ada data', () => {
    expect(paginate([], 0, { page: 1, limit: 20 }).meta.totalPages).toBe(0);
  });
});
