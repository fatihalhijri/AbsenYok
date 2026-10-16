// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonalQr } from '@/types';
import { profileApi } from './api';
import { qrRefreshDelay, useMyQr } from './hooks';

const T0 = Date.parse('2026-10-16T01:00:00.000Z');

const qrAt = (serverNow: number, token: string): PersonalQr => {
  const windowEnd = Math.ceil((serverNow + 1) / 60_000) * 60_000; // window 60 dtk
  return {
    token,
    expiresAt: new Date(windowEnd).toISOString(),
    intervalSeconds: 60,
    serverTime: new Date(serverNow).toISOString(),
  };
};

describe('qrRefreshDelay', () => {
  it('3 dtk sebelum expiresAt (jam perangkat = jam server)', () => {
    const qr = { serverTime: '2026-10-16T01:00:00.000Z', expiresAt: '2026-10-16T01:01:00.000Z' };
    expect(qrRefreshDelay(qr, T0, T0)).toBe(57_000);
  });

  it('dikoreksi bila jam HP terlambat 2 menit', () => {
    const deviceNow = T0 - 120_000;
    const qr = { serverTime: '2026-10-16T01:00:00.000Z', expiresAt: '2026-10-16T01:01:00.000Z' };
    expect(qrRefreshDelay(qr, deviceNow, deviceNow)).toBe(57_000);
  });

  it('token diterima di 3 dtk terakhir (jendela sama) → refresh tepat setelah jendela berganti', () => {
    const qr = { serverTime: '2026-10-16T01:00:57.000Z', expiresAt: '2026-10-16T01:01:00.000Z' };
    const at = Date.parse('2026-10-16T01:00:57.000Z');
    expect(qrRefreshDelay(qr, at, at)).toBe(3_300);
  });
});

describe('useMyQr', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mengambil token baru tepat 3 dtk sebelum habis & token lama tetap tampil saat memuat', async () => {
    let resolveNext: (qr: PersonalQr) => void = () => {};
    const myQr = vi
      .spyOn(profileApi, 'myQr')
      .mockResolvedValueOnce(qrAt(T0, 'TOKEN-A'))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveNext = resolve)));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useMyQr(), { wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data?.token).toBe('TOKEN-A');
    expect(myQr).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(56_900);
    });
    expect(myQr).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200); // t = 57,1 dtk
    });
    expect(myQr).toHaveBeenCalledTimes(2);
    // Selama token baru dimuat, QR lama tetap ada (tidak ada layar kosong/kedip).
    expect(result.current.data?.token).toBe('TOKEN-A');

    await act(async () => {
      resolveNext(qrAt(Date.now(), 'TOKEN-B'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data?.token).toBe('TOKEN-B');

    // Diterima di 3 dtk terakhir (jendela sama) → berikutnya tepat setelah jendela berganti.
    myQr.mockResolvedValue(qrAt(T0 + 60_500, 'TOKEN-C'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000); // t ≈ 60,1 dtk
    });
    expect(myQr).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300); // t ≈ 60,4 dtk
    });
    expect(myQr).toHaveBeenCalledTimes(3);
    expect(result.current.data?.token).toBe('TOKEN-C');
    client.clear();
  });
});
