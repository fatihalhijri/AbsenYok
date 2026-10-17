import type { Page } from '@/lib/api-client';
import type { LeaveRequest, LeaveStatus } from '@/types';

/** Jumlah request approve/reject yang berjalan bersamaan saat setujui massal. */
export const REVIEW_CONCURRENCY = 4;

export type ReviewAction = 'approve' | 'reject';

export const REVIEW_STATUS: Record<ReviewAction, LeaveStatus> = {
  approve: 'APPROVED',
  reject: 'REJECTED',
};

/**
 * Jalankan `worker` untuk tiap item dengan maksimal `limit` sekaligus. Hasil berurutan sesuai
 * input dan tidak pernah reject (seperti `Promise.allSettled`).
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index] as T) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane));
  return results;
}

/**
 * Terapkan status hasil review ke satu halaman daftar. Bila daftar difilter status lain
 * (mis. tab "Menunggu"), item keluar dari daftar dan total berkurang.
 */
export function applyReview(
  page: Page<LeaveRequest>,
  ids: ReadonlySet<string>,
  status: LeaveStatus,
  filterStatus: LeaveStatus | null,
): Page<LeaveRequest> {
  const touched = page.items.filter((item) => ids.has(item.id) && item.status === 'PENDING');
  if (touched.length === 0) return page;
  if (filterStatus && filterStatus !== status) {
    const total = Math.max(0, page.meta.total - touched.length);
    return {
      items: page.items.filter((item) => !touched.includes(item)),
      meta: { ...page.meta, total, totalPages: Math.ceil(total / page.meta.limit) },
    };
  }
  return {
    ...page,
    items: page.items.map((item) => (touched.includes(item) ? { ...item, status } : item)),
  };
}

/** Cache yang di-update optimistis (diimplementasikan di atas QueryClient). */
export interface ReviewCache<S> {
  snapshot: () => S;
  apply: (ids: ReadonlySet<string>) => void;
  restore: (snapshot: S) => void;
}

export interface ReviewOutcome {
  succeeded: string[];
  failed: { id: string; error: unknown }[];
}

/**
 * Review banyak pengajuan: cache langsung di-update (optimistic), request berjalan paralel
 * (maks `REVIEW_CONCURRENCY`), lalu yang gagal di-rollback — yang berhasil tetap ter-update.
 */
export async function reviewWithRollback<S>({
  ids,
  request,
  cache,
  concurrency = REVIEW_CONCURRENCY,
}: {
  ids: readonly string[];
  request: (id: string) => Promise<unknown>;
  cache: ReviewCache<S>;
  concurrency?: number;
}): Promise<ReviewOutcome> {
  const before = cache.snapshot();
  cache.apply(new Set(ids));
  const results = await runWithConcurrency(ids, concurrency, request);

  const outcome: ReviewOutcome = { succeeded: [], failed: [] };
  results.forEach((result, index) => {
    const id = ids[index] as string;
    if (result.status === 'fulfilled') outcome.succeeded.push(id);
    else outcome.failed.push({ id, error: result.reason });
  });
  if (outcome.failed.length > 0) {
    cache.restore(before);
    if (outcome.succeeded.length > 0) cache.apply(new Set(outcome.succeeded));
  }
  return outcome;
}
