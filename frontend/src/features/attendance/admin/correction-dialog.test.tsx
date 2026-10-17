// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttendanceDetail } from '@/types';
import { attendanceAdminApi } from './api';
import { CorrectionDialog } from './correction-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const DETAIL: AttendanceDetail = {
  id: 'a1',
  userId: 'u1',
  date: '2026-10-12',
  status: 'LATE',
  checkInAt: '2026-10-12T01:22:00.000Z', // 08:22 WIB
  checkOutAt: null,
  checkInMethod: 'KIOSK_QR',
  checkOutMethod: null,
  lateMinutes: 22,
  earlyLeaveMinutes: 0,
  workMinutes: 0,
  note: null,
  kioskId: null,
  locationId: null,
  kiosk: null,
  location: null,
  user: { id: 'u1', name: 'Budi Santoso', employeeCode: 'EMP001', department: null },
  shiftSnapshot: {
    name: 'Reguler',
    startTime: '08:00',
    endTime: '17:00',
    lateToleranceMinutes: 15,
  },
  scannedBy: null,
  leaveRequest: null,
  scanLogs: [],
  corrections: [],
  createdAt: '2026-10-12T01:22:00.000Z',
  updatedAt: '2026-10-12T01:22:00.000Z',
};

function renderDialog() {
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CorrectionDialog detail={DETAIL} open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe('CorrectionDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-12T10:00:00.000Z')); // 17:00 WIB
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('tanpa perubahan → tombol simpan nonaktif', () => {
    renderDialog();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Simpan koreksi' }).disabled).toBe(
      true,
    );
  });

  it('jam masuk diubah tanpa alasan → tidak tersimpan, pesan alasan wajib; preview PRESENT', async () => {
    const correct = vi.spyOn(attendanceAdminApi, 'correct');
    renderDialog();

    fireEvent.change(screen.getByLabelText('Jam masuk'), { target: { value: '07:55' } });
    const preview = screen.getByTestId('correction-preview');
    expect(preview.textContent).toContain('Hadir');
    expect(preview.textContent).toContain('07:55');

    fireEvent.click(screen.getByRole('button', { name: 'Simpan koreksi' }));
    expect(await screen.findByText('Alasan koreksi wajib diisi')).toBeTruthy();
    expect(correct).not.toHaveBeenCalled();
  });

  it('dengan alasan ≥ 10 karakter → PATCH hanya field yang berubah + alasan', async () => {
    const correct = vi.spyOn(attendanceAdminApi, 'correct').mockResolvedValue(DETAIL);
    const { onOpenChange } = renderDialog();

    fireEvent.change(screen.getByLabelText('Jam masuk'), { target: { value: '07:55' } });
    fireEvent.change(screen.getByLabelText(/Alasan koreksi/), {
      target: { value: '  Sesuai rekaman CCTV lobi  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan koreksi' }));

    await waitFor(() =>
      expect(correct).toHaveBeenCalledWith('a1', {
        checkInAt: '2026-10-12T07:55:00+07:00',
        reason: 'Sesuai rekaman CCTV lobi',
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
