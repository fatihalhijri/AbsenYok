// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/error';
import { GeoError, type Position } from '@/lib/geolocation';
import type { ScanKioskInput, ScanResult } from '@/types';
import { makeAttendance } from '../test-fixtures';
import { useScanFlow } from './use-scan-flow';

vi.mock('@/lib/feedback', () => ({
  beep: vi.fn(),
  vibrate: vi.fn(),
  VIBRATE_SUCCESS: 80,
  VIBRATE_ERROR: [100, 50, 100],
}));

const QR = 'AY1.K.0d5c9a1e-2b3f-4c4d-8e5f-6a7b8c9d0e1f.59372161.Zx3kQ9vB2mN8pL1sT4wY6a';
const POSITION: Position = { latitude: -6.2, longitude: 106.81, accuracy: 12, timestamp: 1 };
const RESULT: ScanResult = {
  type: 'CHECK_IN',
  attendance: makeAttendance({ checkInAt: '2026-10-15T01:05:00.000Z' }),
  message: 'Absen masuk berhasil pukul 08:05.',
  user: { name: 'Zalindra Zahrah', employeeCode: 'EMP001' },
};

function setup(overrides: { submit?: (input: ScanKioskInput) => Promise<ScanResult> } = {}) {
  const submit = vi.fn(overrides.submit ?? (async () => RESULT));
  const waitForFix = vi.fn(async () => POSITION);
  const getDeviceId = vi.fn(async () => '8f14e45f-ceea-4a7b-9c1d-2b3c4d5e6f70');
  const hook = renderHook(() => useScanFlow({ submit, waitForFix, getDeviceId }));
  return { ...hook, submit, waitForFix };
}

describe('useScanFlow', () => {
  it('QR aplikasi lain tidak pernah dikirim ke server', async () => {
    const { result, submit } = setup();
    await act(() => result.current.handleDecode('https://example.com/promo'));
    await act(() => result.current.handleDecode('AY1.P.user.1.sig'));
    expect(submit).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('scanning');
  });

  it('satu QR terbaca berkali-kali → tepat satu request', async () => {
    let release: (value: ScanResult) => void = () => {};
    const { result, submit } = setup({
      submit: () => new Promise<ScanResult>((resolve) => (release = resolve)),
    });
    await act(async () => {
      void result.current.handleDecode(QR);
      void result.current.handleDecode(QR);
      void result.current.handleDecode(QR);
    });
    expect(result.current.phase).toBe('processing');
    await act(async () => release(RESULT));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      qrToken: QR,
      latitude: -6.2,
      longitude: 106.81,
      accuracy: 12,
      deviceId: '8f14e45f-ceea-4a7b-9c1d-2b3c4d5e6f70',
    });
    expect(result.current.outcome).toEqual({ kind: 'success', result: RESULT });

    // Masih terkunci sampai "Scan Ulang".
    await act(() => result.current.handleDecode(QR));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('error server → outcome error; reset membuka kunci untuk scan berikutnya', async () => {
    const { result, submit } = setup({
      submit: async () => {
        throw new ApiError({ code: 'QR_EXPIRED', message: 'QR kedaluwarsa', status: 422 });
      },
    });
    await act(() => result.current.handleDecode(QR));
    expect(result.current.phase).toBe('result');
    expect(result.current.outcome).toMatchObject({ kind: 'error', error: { code: 'QR_EXPIRED' } });

    act(() => result.current.reset());
    expect(result.current.phase).toBe('scanning');
    await act(() => result.current.handleDecode(QR));
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('lokasi tidak didapat dalam batas waktu → GEO_TIMEOUT tanpa request', async () => {
    const { result, submit, waitForFix } = setup();
    waitForFix.mockRejectedValueOnce(new GeoError('TIMEOUT'));
    await act(() => result.current.handleDecode(QR));
    expect(waitForFix).toHaveBeenCalledWith(8000);
    expect(submit).not.toHaveBeenCalled();
    expect(result.current.outcome).toMatchObject({ kind: 'error', error: { code: 'GEO_TIMEOUT' } });
  });
});
