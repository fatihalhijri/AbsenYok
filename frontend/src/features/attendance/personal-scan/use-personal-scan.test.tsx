// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/error';
import type { PersonalScanInput, ScanResult } from '@/types';
import { makeAttendance } from '../test-fixtures';
import { ERROR_RETRY_MS, REARM_DELAY_MS, usePersonalScan } from './use-personal-scan';

vi.mock('@/lib/feedback', () => ({
  beep: vi.fn(),
  vibrate: vi.fn(),
  VIBRATE_SUCCESS: 1,
  VIBRATE_ERROR: 2,
}));

const POSITION = { latitude: -6.2, longitude: 106.8, accuracy: 12, timestamp: 0 };
const token = (n: number) => `AY1.P.user-${n}.123456.signature${n}`;

const result = (n: number): ScanResult => ({
  type: 'CHECK_IN',
  attendance: makeAttendance({
    id: `a${n}`,
    status: 'PRESENT',
    checkInAt: '2026-10-12T00:55:00.000Z',
  }),
  message: 'Absen masuk berhasil',
  user: { name: `Karyawan ${n}`, employeeCode: `EMP00${n}` },
});

let clock = 0;
function setup(submit: (input: PersonalScanInput) => Promise<ScanResult>, continuous = true) {
  return renderHook(() =>
    usePersonalScan({
      locationId: 'loc-1',
      waitForFix: async () => POSITION,
      submit,
      continuous,
      now: () => clock,
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = 1_000_000;
});
afterEach(() => vi.useRealTimers());

describe('usePersonalScan', () => {
  it('5 karyawan berturut-turut: hasil tampil lalu aktif lagi otomatis 2 detik', async () => {
    const submit = vi.fn(async (input: PersonalScanInput) =>
      result(Number(input.qrToken.split('.')[2]?.split('-')[1])),
    );
    const { result: hook } = setup(submit);

    for (let n = 1; n <= 5; n += 1) {
      await act(() => hook.current.handleDecode(token(n)));
      expect(hook.current.phase).toBe('result');
      act(() => vi.advanceTimersByTime(REARM_DELAY_MS));
      expect(hook.current.phase).toBe('scanning');
      clock += 3_000;
    }

    expect(submit).toHaveBeenCalledTimes(5);
    expect(submit.mock.calls[0]?.[0]).toEqual({
      qrToken: token(1),
      locationId: 'loc-1',
      latitude: -6.2,
      longitude: 106.8,
      accuracy: 12,
    });
    // Terbaru di atas.
    expect(
      hook.current.session.map((entry) =>
        entry.outcome.kind === 'success' ? entry.outcome.result.user.name : 'x',
      ),
    ).toEqual(['Karyawan 5', 'Karyawan 4', 'Karyawan 3', 'Karyawan 2', 'Karyawan 1']);
  });

  it('token yang sama (HP masih tersodor) & QR non-personal diabaikan', async () => {
    const submit = vi.fn(async () => result(1));
    const { result: hook } = setup(submit);
    await act(() => hook.current.handleDecode(token(1)));
    act(() => vi.advanceTimersByTime(REARM_DELAY_MS));
    await act(() => hook.current.handleDecode(token(1)));
    await act(() => hook.current.handleDecode('AY1.K.kiosk.123.sig'));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(hook.current.session).toHaveLength(1);
  });

  it('mode beruntun mati → tetap di hasil sampai petugas menekan lanjut', async () => {
    const { result: hook } = setup(async () => result(1), false);
    await act(() => hook.current.handleDecode(token(1)));
    act(() => vi.advanceTimersByTime(REARM_DELAY_MS * 3));
    expect(hook.current.phase).toBe('result');
    act(() => hook.current.reset());
    expect(hook.current.phase).toBe('scanning');
  });

  it('gagal → token baru boleh dicoba otomatis setelah jeda; "Scan ulang" langsung', async () => {
    const submit = vi
      .fn<(input: PersonalScanInput) => Promise<ScanResult>>()
      .mockRejectedValue(
        new ApiError({ code: 'OUTSIDE_GEOFENCE', message: 'Di luar area', status: 422 }),
      );
    const { result: hook } = setup(submit);

    await act(() => hook.current.handleDecode(token(1)));
    expect(hook.current.outcome).toMatchObject({ kind: 'error' });
    act(() => vi.advanceTimersByTime(REARM_DELAY_MS));
    // Masih dalam jeda → diabaikan (tidak ada error berulang tiap 2 detik).
    await act(() => hook.current.handleDecode(token(1)));
    expect(submit).toHaveBeenCalledTimes(1);

    clock += ERROR_RETRY_MS;
    await act(() => hook.current.handleDecode(token(1)));
    expect(submit).toHaveBeenCalledTimes(2);

    // Scan ulang manual: token gagal terakhir langsung boleh lagi.
    act(() => hook.current.retry());
    await act(() => hook.current.handleDecode(token(1)));
    expect(submit).toHaveBeenCalledTimes(3);
  });

  it('QR_ALREADY_USED tidak dicoba ulang otomatis', async () => {
    const submit = vi
      .fn<(input: PersonalScanInput) => Promise<ScanResult>>()
      .mockRejectedValue(
        new ApiError({ code: 'QR_ALREADY_USED', message: 'Sudah dipakai', status: 422 }),
      );
    const { result: hook } = setup(submit);
    await act(() => hook.current.handleDecode(token(2)));
    act(() => vi.advanceTimersByTime(REARM_DELAY_MS));
    clock += ERROR_RETRY_MS;
    await act(() => hook.current.handleDecode(token(2)));
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
