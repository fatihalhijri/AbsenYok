// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHECKED_IN, makeAttendance, makeToday } from '../test-fixtures';
import * as todayStatus from '../today-status';
import { TodayStatusCard } from './today-status-card';

vi.mock('next/link', () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

// Bungkus deriveTodayState dengan spy agar jumlah pemanggilannya bisa dihitung.
vi.mock('../today-status', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../today-status')>();
  return { ...actual, deriveTodayState: vi.fn(actual.deriveTodayState) };
});

const card = () => screen.getByRole('region', { name: 'Status absensi hari ini' });

describe('TodayStatusCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-10-12T02:05:00.000Z')); // 09:05 WIB
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('belum absen → tombol "Scan Absen Masuk" ke /app/scan', () => {
    render(<TodayStatusCard today={makeToday()} />);
    expect(card()).toHaveProperty('dataset.state', 'ready');
    expect(screen.getByText('Belum absen masuk')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Scan Absen Masuk' });
    expect(link.getAttribute('href')).toBe('/app/scan');
  });

  it('sudah masuk → durasi kerja berjalan + tombol "Scan Absen Pulang"', () => {
    render(
      <TodayStatusCard
        today={makeToday({ canCheckIn: false, canCheckOut: true, attendance: CHECKED_IN })}
      />,
    );
    expect(card()).toHaveProperty('dataset.state', 'checked-in');
    expect(screen.getByText('Sedang bekerja')).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('1:00:00');
    expect(screen.getByRole('link', { name: 'Scan Absen Pulang' })).toBeTruthy();
  });

  it('sudah masuk, jeda minimal belum lewat → info kapan absen pulang tersedia', () => {
    render(
      <TodayStatusCard
        today={makeToday({
          canCheckIn: false,
          attendance: CHECKED_IN,
          checkOutAvailableAt: '2026-10-12T02:10:00.000Z',
        })}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/Absen pulang tersedia pukul 09:10/)).toBeTruthy();
  });

  it('sudah pulang → ringkasan masuk/pulang/total kerja', () => {
    render(
      <TodayStatusCard
        today={makeToday({
          canCheckIn: false,
          attendance: makeAttendance({
            checkInAt: '2026-10-12T01:00:00.000Z',
            checkOutAt: '2026-10-12T10:00:00.000Z',
            workMinutes: 540,
          }),
        })}
      />,
    );
    expect(card()).toHaveProperty('dataset.state', 'checked-out');
    expect(screen.getByText('Absen hari ini selesai')).toBeTruthy();
    expect(screen.getByText('08:00')).toBeTruthy();
    expect(screen.getByText('17:00')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('izin/cuti disetujui → tanpa tombol scan', () => {
    render(
      <TodayStatusCard
        today={makeToday({
          canCheckIn: false,
          leave: {
            id: '6f1c2c1e-0000-4000-8000-0000000000b1',
            type: 'SICK',
            startDate: '2026-10-12',
            endDate: '2026-10-12',
          },
        })}
      />,
    );
    expect(card()).toHaveProperty('dataset.state', 'on-leave');
    expect(screen.getByText('Anda sedang sakit hari ini')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('hari libur → nama libur', () => {
    render(
      <TodayStatusCard
        today={makeToday({
          canCheckIn: false,
          isWorkingDay: false,
          holiday: {
            id: '6f1c2c1e-0000-4000-8000-0000000000c1',
            date: '2026-10-12',
            name: 'Cuti Bersama',
          },
        })}
      />,
    );
    expect(card()).toHaveProperty('dataset.state', 'holiday');
    expect(screen.getByText(/Cuti Bersama/)).toBeTruthy();
  });

  it('bukan hari kerja / belum ada shift', () => {
    const { rerender } = render(
      <TodayStatusCard today={makeToday({ canCheckIn: false, isWorkingDay: false })} />,
    );
    expect(screen.getByText('Bukan hari kerja Anda')).toBeTruthy();
    rerender(
      <TodayStatusCard
        today={makeToday({ shift: null, canCheckIn: false, isWorkingDay: false })}
      />,
    );
    expect(screen.getByText('Belum ada jadwal shift')).toBeTruthy();
  });

  it('belum dibuka → hitung mundur; onRefresh dipanggil sekali saat habis', () => {
    const onRefresh = vi.fn();
    vi.setSystemTime(new Date('2026-10-11T23:59:57.000Z'));
    render(
      <TodayStatusCard
        today={makeToday({ canCheckIn: false, serverTime: '2026-10-11T23:59:57.000Z' })}
        onRefresh={onRefresh}
      />,
    );
    expect(screen.getByRole('timer').textContent).toBe('00:03');
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole('timer').textContent).toBe('00:00');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('detik berjalan hanya me-render ulang komponen waktu, bukan kartu', () => {
    const derive = vi.mocked(todayStatus.deriveTodayState);
    derive.mockClear();
    render(
      <TodayStatusCard
        today={makeToday({ canCheckIn: false, canCheckOut: true, attendance: CHECKED_IN })}
      />,
    );
    const timer = screen.getByRole('timer');
    expect(timer.textContent).toBe('1:00:00');
    expect(derive).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(3000));

    expect(timer.textContent).toBe('1:00:03');
    expect(derive).toHaveBeenCalledTimes(1);
  });
});
