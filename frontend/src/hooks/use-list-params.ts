'use client';

import type { OnChangeFn, PaginationState, SortingState } from '@tanstack/react-table';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';

/** Batas backend (`MAX_PAGE_LIMIT`). */
const MAX_LIMIT = 100;

export interface ListParamsConfig<F extends string = string> {
  defaultLimit?: number;
  /** Sort default saat URL tidak menyebutkan (`sortBy` harus ada di `sortable`). */
  defaultSort?: { id: string; desc: boolean };
  /** Kolom yang boleh di-sort server (`*_SORT_FIELDS` backend) — nilai lain diabaikan. */
  sortable: readonly string[];
  /** Nama query filter (mis. `departmentId`, `role`, `isActive`). */
  filters?: readonly F[];
}

export interface ListParams<F extends string = string> {
  page: number;
  limit: number;
  sortBy: string | null;
  sortOrder: 'asc' | 'desc';
  search: string;
  filters: Record<F, string | null>;
}

type Reader = Pick<URLSearchParams, 'get'>;

const positiveInt = (value: string | null) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Baca state daftar dari URL (nilai tak valid → default). */
export function parseListParams<F extends string>(
  params: Reader,
  config: ListParamsConfig<F>,
): ListParams<F> {
  const defaultLimit = config.defaultLimit ?? 20;
  const sortBy = params.get('sortBy');
  const validSort = sortBy && config.sortable.includes(sortBy) ? sortBy : null;
  const order = params.get('sortOrder');
  const filters = Object.fromEntries(
    (config.filters ?? []).map((key) => [key, params.get(key) || null]),
  ) as Record<F, string | null>;
  return {
    page: positiveInt(params.get('page')) ?? 1,
    limit: Math.min(MAX_LIMIT, positiveInt(params.get('limit')) ?? defaultLimit),
    sortBy: validSort ?? config.defaultSort?.id ?? null,
    sortOrder: validSort
      ? order === 'asc'
        ? 'asc'
        : 'desc'
      : config.defaultSort?.desc === false
        ? 'asc'
        : 'desc',
    search: params.get('search')?.trim() ?? '',
    filters,
  };
}

export type ListParamsPatch<F extends string> = Partial<Omit<ListParams<F>, 'filters'>> & {
  filters?: Partial<Record<F, string | null>>;
};

export const mergeListParams = <F extends string>(
  current: ListParams<F>,
  patch: ListParamsPatch<F>,
): ListParams<F> => ({ ...current, ...patch, filters: { ...current.filters, ...patch.filters } });

/** Query string baru: nilai default dihapus agar URL tetap ringkas & mudah dibagikan. */
export function buildListSearch<F extends string>(
  current: ListParams<F>,
  patch: ListParamsPatch<F>,
  config: ListParamsConfig<F>,
): string {
  const next = mergeListParams(current, patch);
  const params = new URLSearchParams();
  if (next.page > 1) params.set('page', String(next.page));
  if (next.limit !== (config.defaultLimit ?? 20)) params.set('limit', String(next.limit));
  const isDefaultSort =
    next.sortBy === (config.defaultSort?.id ?? null) &&
    (next.sortOrder === 'desc') === (config.defaultSort?.desc ?? true);
  if (next.sortBy && !isDefaultSort) {
    params.set('sortBy', next.sortBy);
    params.set('sortOrder', next.sortOrder);
  }
  if (next.search) params.set('search', next.search);
  for (const [key, value] of Object.entries(next.filters) as [F, string | null][]) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

/** Parameter siap kirim ke API (`page, limit, sortBy, sortOrder, search, ...filter`). */
export function toApiQuery<F extends string>(params: ListParams<F>) {
  return {
    page: params.page,
    limit: params.limit,
    ...(params.sortBy ? { sortBy: params.sortBy, sortOrder: params.sortOrder } : {}),
    ...(params.search ? { search: params.search } : {}),
    ...Object.fromEntries(Object.entries(params.filters).filter(([, value]) => value)),
  };
}

/**
 * State tabel (halaman, ukuran, sort, pencarian, filter) disimpan di URL search params →
 * bisa di-refresh & dibagikan. Wajib dipakai di dalam `<Suspense>` (useSearchParams).
 */
export function useListParams<F extends string = never>(config: ListParamsConfig<F>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useMemo(() => parseListParams(searchParams, config), [searchParams, config]);

  // Beberapa perubahan dalam satu event (mis. pencarian lalu reset halaman) harus digabung:
  // router.replace bersifat async, jadi `params` dari URL belum memuat perubahan sebelumnya.
  const pending = useRef<ListParams<F> | null>(null);
  useEffect(() => {
    pending.current = null;
  }, [searchParams]);

  const update = useCallback(
    (patch: ListParamsPatch<F>) => {
      const base = pending.current ?? params;
      pending.current = mergeListParams(base, patch);
      const query = buildListSearch(base, patch, config);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [config, params, pathname, router],
  );

  const pagination: PaginationState = { pageIndex: params.page - 1, pageSize: params.limit };
  const sorting: SortingState = params.sortBy
    ? [{ id: params.sortBy, desc: params.sortOrder === 'desc' }]
    : [];

  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater;
    update({ page: next.pageIndex + 1, limit: next.pageSize });
  };
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const first = next[0];
    update({
      page: 1,
      sortBy: first?.id ?? config.defaultSort?.id ?? null,
      sortOrder: first
        ? first.desc
          ? 'desc'
          : 'asc'
        : config.defaultSort?.desc === false
          ? 'asc'
          : 'desc',
    });
  };

  return {
    params,
    query: toApiQuery(params),
    pagination,
    sorting,
    onPaginationChange,
    onSortingChange,
    setSearch: (search: string) => update({ search, page: 1 }),
    setFilter: (key: F, value: string | null) =>
      update({ filters: { [key]: value } as Partial<Record<F, string | null>>, page: 1 }),
    resetFilters: () =>
      update({
        page: 1,
        search: '',
        filters: Object.fromEntries((config.filters ?? []).map((key) => [key, null])) as Partial<
          Record<F, string | null>
        >,
      }),
  };
}
