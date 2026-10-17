import { describe, expect, it } from 'vitest';
import type { Page } from '@/lib/api-client';
import type { LeaveRequest } from '@/types';
import { applyReview, reviewWithRollback, runWithConcurrency } from './review';

function leave(id: string, status: LeaveRequest['status'] = 'PENDING'): LeaveRequest {
  return {
    id,
    userId: 'u1',
    type: 'PERMIT',
    startDate: '2026-11-02',
    endDate: '2026-11-02',
    totalDays: 1,
    reason: 'Keperluan keluarga',
    hasAttachment: false,
    status,
    user: { id: 'u1', name: 'Budi', employeeCode: 'EMP001', department: null },
    createdAt: '2026-10-20T01:00:00.000Z',
    updatedAt: '2026-10-20T01:00:00.000Z',
  };
}

const page = (items: LeaveRequest[], total = items.length): Page<LeaveRequest> => ({
  items,
  meta: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) },
});

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
};

describe('runWithConcurrency', () => {
  it('maksimal N berjalan bersamaan, hasil berurutan & error tidak menghentikan lainnya', async () => {
    let running = 0;
    let peak = 0;
    const results = await runWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5 - (n % 3)));
      running -= 1;
      if (n === 3) throw new Error('gagal');
      return n * 10;
    });
    expect(peak).toBe(4);
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : 'x'))).toEqual([
      10,
      20,
      'x',
      40,
      50,
      60,
      70,
      80,
      90,
      100,
    ]);
  });
});

describe('applyReview', () => {
  const items = [leave('a'), leave('b'), leave('c')];

  it('tab Menunggu: item yang disetujui keluar dari daftar & total berkurang', () => {
    const next = applyReview(page(items, 23), new Set(['a', 'c']), 'APPROVED', 'PENDING');
    expect(next.items.map((item) => item.id)).toEqual(['b']);
    expect(next.meta).toMatchObject({ total: 21, totalPages: 2 });
  });

  it('tab Semua: status item berubah di tempat', () => {
    const next = applyReview(page(items), new Set(['b']), 'REJECTED', null);
    expect(next.items.map((item) => item.status)).toEqual(['PENDING', 'REJECTED', 'PENDING']);
  });

  it('item bukan PENDING tidak disentuh; tidak ada yang cocok → objek sama', () => {
    const original = page([leave('a', 'CANCELLED')]);
    expect(applyReview(original, new Set(['a']), 'APPROVED', null)).toBe(original);
  });
});

describe('reviewWithRollback', () => {
  it('optimistic segera, lalu hanya yang gagal di-rollback', async () => {
    let state = page([leave('a'), leave('b'), leave('c')]);
    const gate = deferred();
    const cache = {
      snapshot: () => state,
      apply: (ids: ReadonlySet<string>) => (state = applyReview(state, ids, 'APPROVED', 'PENDING')),
      restore: (snapshot: Page<LeaveRequest>) => (state = snapshot),
    };

    const running = reviewWithRollback({
      ids: ['a', 'b', 'c'],
      cache,
      request: async (id) => {
        await gate.promise;
        if (id === 'b') throw new Error('Pengajuan sudah diproses');
      },
    });
    // Sebelum server menjawab: semua sudah hilang dari tab Menunggu.
    expect(state.items).toEqual([]);

    gate.resolve();
    const outcome = await running;
    expect(outcome.succeeded).toEqual(['a', 'c']);
    expect(outcome.failed.map((item) => item.id)).toEqual(['b']);
    expect(state.items.map((item) => item.id)).toEqual(['b']);
    expect(state.meta.total).toBe(1);
  });

  it('semua berhasil → tidak ada rollback', async () => {
    let restored = false;
    const outcome = await reviewWithRollback({
      ids: ['a'],
      request: async () => undefined,
      cache: { snapshot: () => null, apply: () => undefined, restore: () => (restored = true) },
    });
    expect(outcome).toEqual({ succeeded: ['a'], failed: [] });
    expect(restored).toBe(false);
  });
});
