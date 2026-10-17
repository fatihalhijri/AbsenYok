// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ListParamsConfig, useListParams } from './use-list-params';

const replace = vi.fn();
let search = 'page=3';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/admin/employees',
  useSearchParams: () => new URLSearchParams(search),
}));

const CONFIG: ListParamsConfig<'role'> = {
  sortable: ['name'],
  defaultSort: { id: 'name', desc: false },
  filters: ['role'],
};

describe('useListParams', () => {
  it('pencarian lalu reset halaman dalam satu event → keduanya tersimpan (tidak saling menimpa)', () => {
    const { result } = renderHook(() => useListParams(CONFIG));
    act(() => {
      result.current.setSearch('samiah');
      // DataTable memanggil ini tepat setelah kata kunci berubah.
      result.current.onPaginationChange((state) => ({ ...state, pageIndex: 0 }));
    });
    expect(replace).toHaveBeenLastCalledWith('/admin/employees?search=samiah', { scroll: false });
  });

  it('filter + sort dari URL yang ada dipertahankan', () => {
    search = 'role=ADMIN';
    replace.mockClear();
    const { result } = renderHook(() => useListParams(CONFIG));
    act(() => result.current.onSortingChange([{ id: 'name', desc: true }]));
    expect(replace).toHaveBeenLastCalledWith(
      '/admin/employees?sortBy=name&sortOrder=desc&role=ADMIN',
      { scroll: false },
    );
  });
});
