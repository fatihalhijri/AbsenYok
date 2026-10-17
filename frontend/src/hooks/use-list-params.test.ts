import { describe, expect, it } from 'vitest';
import {
  buildListSearch,
  type ListParamsConfig,
  parseListParams,
  toApiQuery,
} from './use-list-params';

type F = 'departmentId' | 'role';
const CONFIG: ListParamsConfig<F> = {
  sortable: ['name', 'createdAt'],
  defaultSort: { id: 'name', desc: false },
  filters: ['departmentId', 'role'],
};
const parse = (query: string) => parseListParams(new URLSearchParams(query), CONFIG);

describe('parseListParams', () => {
  it('URL kosong → default', () => {
    expect(parse('')).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'name',
      sortOrder: 'asc',
      search: '',
      filters: { departmentId: null, role: null },
    });
  });

  it('membaca halaman, sort, pencarian & filter', () => {
    expect(
      parse('page=3&limit=50&sortBy=createdAt&sortOrder=desc&search=%20budi%20&role=ADMIN'),
    ).toMatchObject({
      page: 3,
      limit: 50,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      search: 'budi',
      filters: { departmentId: null, role: 'ADMIN' },
    });
  });

  it('nilai tak valid diabaikan (sort bukan whitelist, limit > 100, page negatif)', () => {
    expect(parse('page=-2&limit=500&sortBy=password')).toMatchObject({
      page: 1,
      limit: 100,
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });
});

describe('buildListSearch', () => {
  it('nilai default tidak ditulis ke URL', () => {
    expect(buildListSearch(parse(''), {}, CONFIG)).toBe('');
  });

  it('filter + reset halaman', () => {
    const current = parse('page=4');
    expect(buildListSearch(current, { page: 1, filters: { role: 'EMPLOYEE' } }, CONFIG)).toBe(
      'role=EMPLOYEE',
    );
  });

  it('sort non-default & pencarian tersimpan (bisa dibagikan/refresh)', () => {
    const query = buildListSearch(
      parse(''),
      { sortBy: 'createdAt', sortOrder: 'desc', search: 'eka' },
      CONFIG,
    );
    expect(query).toBe('sortBy=createdAt&sortOrder=desc&search=eka');
    expect(parse(query)).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc', search: 'eka' });
  });

  it('menghapus filter (null)', () => {
    expect(
      buildListSearch(parse('role=ADMIN&departmentId=d1'), { filters: { role: null } }, CONFIG),
    ).toBe('departmentId=d1');
  });
});

describe('toApiQuery', () => {
  it('hanya mengirim parameter yang terisi', () => {
    expect(toApiQuery(parse('role=ADMIN'))).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'name',
      sortOrder: 'asc',
      role: 'ADMIN',
    });
  });
});
