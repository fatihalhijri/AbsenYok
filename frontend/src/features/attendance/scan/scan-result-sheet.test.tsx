// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/error';
import type { ScanResult } from '@/types';
import { makeAttendance } from '../test-fixtures';
import { ACTION_LABELS, describeScanError } from './scan-errors';
import { AUTO_REDIRECT_MS, ScanResultSheet } from './scan-result-sheet';
import type { ScanOutcome } from './use-scan-flow';

const SUCCESS: ScanOutcome = {
  kind: 'success',
  result: {
    type: 'CHECK_IN',
    attendance: makeAttendance({
      status: 'LATE',
      checkInAt: '2026-10-12T01:22:00.000Z', // 08:22 WIB
      lateMinutes: 7,
    }),
    message: 'Absen masuk berhasil pukul 08:22. Anda terlambat 7 menit.',
    user: { name: 'Budi Santoso', employeeCode: 'EMP001' },
  } satisfies ScanResult,
};

const error = (code: string, message = `Pesan ${code}`, details?: unknown): ScanOutcome => ({
  kind: 'error',
  error: new ApiError({ code, message, status: 422, details }),
});

/** Semua kode error scan dari docs/API-CONTRACT.md + kode lokasi perangkat & jaringan. */
const ERROR_CODES = [
  'QR_INVALID',
  'QR_EXPIRED',
  'QR_ALREADY_USED',
  'KIOSK_INACTIVE',
  'DEVICE_MISMATCH',
  'LOCATION_ACCURACY_LOW',
  'OUTSIDE_GEOFENCE',
  'NO_SHIFT_ASSIGNED',
  'NOT_WORKING_DAY',
  'HOLIDAY',
  'ON_LEAVE',
  'CHECKIN_WINDOW_CLOSED',
  'CHECKOUT_TOO_SOON',
  'ALREADY_CHECKED_IN',
  'ALREADY_CHECKED_OUT',
  'TOO_MANY_REQUESTS',
  'ACCOUNT_INACTIVE',
  'NETWORK_ERROR',
  'TIMEOUT',
  'GEO_PERMISSION_DENIED',
  'GEO_TIMEOUT',
  'UNKNOWN_CODE',
];

describe('ScanResultSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('sukses: judul, jam, status, pesan; otomatis kembali ke beranda setelah 5 detik', () => {
    const onAction = vi.fn();
    render(<ScanResultSheet outcome={SUCCESS} onAction={onAction} />);
    expect(screen.getByRole('heading', { name: 'Absen Masuk Berhasil' })).toBeTruthy();
    expect(screen.getByText('08:22')).toBeTruthy();
    expect(screen.getByText('Terlambat')).toBeTruthy();
    expect(screen.getByText(/terlambat 7 menit/)).toBeTruthy();

    act(() => vi.advanceTimersByTime(AUTO_REDIRECT_MS - 1));
    expect(onAction).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onAction).toHaveBeenCalledWith('home');
  });

  it('sukses tanpa autoRedirect (scan petugas) → tidak pindah otomatis', () => {
    const onAction = vi.fn();
    render(<ScanResultSheet outcome={SUCCESS} onAction={onAction} autoRedirect={false} />);
    act(() => vi.advanceTimersByTime(AUTO_REDIRECT_MS * 2));
    expect(onAction).not.toHaveBeenCalled();
  });

  it.each(ERROR_CODES)('gagal %s → judul, pesan server & tombol aksi sesuai pemetaan', (code) => {
    const onAction = vi.fn();
    const outcome = error(code);
    render(<ScanResultSheet outcome={outcome} onAction={onAction} />);
    const view = describeScanError(code, `Pesan ${code}`);

    expect(screen.getByRole('heading', { name: view.title })).toBeTruthy();
    expect(screen.getByText(`Pesan ${code}`)).toBeTruthy();
    expect(document.querySelector(`[data-outcome="${code}"]`)).not.toBeNull();
    const buttons = view.actions.map((action) =>
      screen.getByRole('button', { name: ACTION_LABELS[action] }),
    );
    fireEvent.click(buttons[0] as HTMLElement);
    expect(onAction).toHaveBeenCalledWith(view.actions[0]);
  });

  it('OUTSIDE_GEOFENCE menampilkan fakta jarak & radius dari details', () => {
    render(
      <ScanResultSheet
        outcome={error('OUTSIDE_GEOFENCE', 'Anda di luar area kantor', {
          distance: 245.4,
          radius: 100,
        })}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText('245 m')).toBeTruthy();
    expect(screen.getByText('100 m')).toBeTruthy();
  });

  it('varian ringkas: nama karyawan, tipe & status; tombol lanjut → scan-again', () => {
    const onAction = vi.fn();
    render(
      <ScanResultSheet
        variant="compact"
        outcome={SUCCESS}
        onAction={onAction}
        autoContinueMs={2000}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Budi Santoso' })).toBeTruthy();
    expect(screen.getByText('Absen Masuk')).toBeTruthy();
    expect(screen.getByText('EMP001')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Scan berikutnya' }));
    expect(onAction).toHaveBeenCalledWith('scan-again');
  });

  it('varian ringkas gagal → judul error + "Scan ulang"', () => {
    render(<ScanResultSheet variant="compact" outcome={error('QR_EXPIRED')} onAction={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'QR sudah kedaluwarsa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Scan ulang' })).toBeTruthy();
  });

  it('outcome null → tidak ada dialog', () => {
    render(<ScanResultSheet outcome={null} onAction={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
