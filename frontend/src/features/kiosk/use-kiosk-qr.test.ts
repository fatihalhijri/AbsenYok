// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/error';
import type { KioskQr } from '@/types';
import { useKioskQr } from './use-kiosk-qr';

const T0 = Date.parse('2026-10-17T01:00:05.000Z');
const INTERVAL = 30_000;

/** Token jendela berjalan menurut jam (palsu) saat ini. */
function tokenNow(): KioskQr {
  const now = Date.now();
  const window = Math.floor(now / INTERVAL);
  return {
    token: `AY1.K.k1.${window}.sig${window}`,
    expiresAt: new Date((window + 1) * INTERVAL).toISOString(),
    intervalSeconds: 30,
    serverTime: new Date(now).toISOString(),
    kiosk: { id: 'k1', name: 'Lobi Utama', locationName: 'Kantor Pusat' },
  };
}

const networkError = () =>
  new ApiError({ code: 'NETWORK_ERROR', message: 'Tidak dapat terhubung', status: 0 });

const flush = () => act(async () => vi.advanceTimersByTimeAsync(0));
const advance = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));

describe('useKioskQr', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('memuat token lalu menjadwalkan expiresAt − 1 dtk dan saat jendela berganti', async () => {
    const fetchQr = vi.fn(async () => tokenNow());
    const { result } = renderHook(() => useKioskQr('k1', { fetchQr }));
    await flush();
    expect(result.current.connection).toBe('live');
    const first = result.current.qr?.token;

    await advance(23_900); // t = 28,9 dtk (sebelum expiresAt − 1)
    expect(fetchQr).toHaveBeenCalledTimes(1);
    await advance(200); // t = 29,1 → diminta (jendela sama)
    expect(fetchQr).toHaveBeenCalledTimes(2);
    expect(result.current.qr?.token).toBe(first);

    await advance(1_300); // t = 30,4 → jendela baru
    expect(fetchQr).toHaveBeenCalledTimes(3);
    expect(result.current.qr?.token).not.toBe(first);
  });

  it('gagal → reconnecting (QR disembunyikan) & coba lagi 2, 4, 8 dtk; pulih otomatis', async () => {
    const fetchQr = vi.fn(async () => tokenNow());
    const { result } = renderHook(() => useKioskQr('k1', { fetchQr }));
    await flush();
    expect(result.current.connection).toBe('live');

    fetchQr.mockRejectedValue(networkError());
    await advance(24_100); // jadwal refresh berikutnya gagal
    expect(result.current.connection).toBe('reconnecting');
    expect(result.current.failures).toBe(1);
    const calls = fetchQr.mock.calls.length;

    await advance(1_800); // t ≈ 30,9 (gagal di 29,0 → retry 31,0)
    expect(fetchQr).toHaveBeenCalledTimes(calls);
    await advance(200); // +2 dtk
    expect(fetchQr).toHaveBeenCalledTimes(calls + 1);
    expect(result.current.failures).toBe(2);
    await advance(4_000); // +4 dtk
    expect(fetchQr).toHaveBeenCalledTimes(calls + 2);
    expect(result.current.failures).toBe(3);

    fetchQr.mockImplementation(async () => tokenNow());
    await advance(8_000); // +8 dtk → berhasil
    expect(result.current.connection).toBe('live');
    expect(result.current.failures).toBe(0);
  });

  it('jaringan putus (event offline) → langsung reconnecting; online → dicoba segera', async () => {
    const fetchQr = vi.fn(async () => tokenNow());
    const { result } = renderHook(() => useKioskQr('k1', { fetchQr }));
    await flush();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.connection).toBe('reconnecting');

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchQr).toHaveBeenCalledTimes(2);
    expect(result.current.connection).toBe('live');
  });

  it('kiosk nonaktif (422) → unavailable dengan pesan server, tetap dicoba ulang', async () => {
    const fetchQr = vi.fn(async (): Promise<KioskQr> => {
      throw new ApiError({ code: 'KIOSK_INACTIVE', message: 'Kiosk tidak aktif', status: 422 });
    });
    const { result } = renderHook(() => useKioskQr('k1', { fetchQr }));
    await flush();
    expect(result.current.connection).toBe('unavailable');
    expect(result.current.message).toBe('Kiosk tidak aktif');
    await advance(2_000);
    expect(fetchQr).toHaveBeenCalledTimes(2);
  });

  it('sesi ditolak (401) → unauthorized tanpa percobaan ulang', async () => {
    const fetchQr = vi.fn(async (): Promise<KioskQr> => {
      throw new ApiError({ code: 'TOKEN_INVALID', message: 'Sesi berakhir', status: 401 });
    });
    const { result } = renderHook(() => useKioskQr('k1', { fetchQr }));
    await flush();
    expect(result.current.connection).toBe('unauthorized');
    await advance(60_000);
    expect(fetchQr).toHaveBeenCalledTimes(1);
  });

  it('unmount menghentikan semua timer', async () => {
    const fetchQr = vi.fn(async () => tokenNow());
    const { unmount } = renderHook(() => useKioskQr('k1', { fetchQr }));
    await flush();
    unmount();
    await advance(120_000);
    expect(fetchQr).toHaveBeenCalledTimes(1);
  });
});
