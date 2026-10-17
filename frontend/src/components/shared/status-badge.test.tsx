// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AttendanceStatus, LeaveStatus } from '@/types';
import {
  ATTENDANCE_STATUS_META,
  attendanceDotClass,
  LEAVE_STATUS_META,
  StatusBadge,
} from './status-badge';

afterEach(cleanup);

describe('StatusBadge', () => {
  it.each(Object.entries(ATTENDANCE_STATUS_META) as [AttendanceStatus, { label: string }][])(
    'absensi %s → label "%s" + data-status',
    (status, meta) => {
      render(<StatusBadge status={status} />);
      const badge = screen.getByText(meta.label);
      expect(badge.closest('[data-status]')?.getAttribute('data-status')).toBe(status);
    },
  );

  it.each(Object.entries(LEAVE_STATUS_META) as [LeaveStatus, { label: string }][])(
    'izin %s → label "%s"',
    (status, meta) => {
      render(<StatusBadge kind="leave" status={status} />);
      expect(screen.getByText(meta.label)).toBeTruthy();
    },
  );

  it('identitas tidak hanya warna: titik warna disembunyikan dari pembaca layar, label tetap teks', () => {
    const { container } = render(<StatusBadge status="LATE" />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(container.textContent).toBe('Terlambat');
  });

  it('className tambahan digabung; warna titik konsisten untuk kalender', () => {
    const { container } = render(<StatusBadge status="ABSENT" className="ml-auto" />);
    expect(container.firstElementChild?.className).toContain('ml-auto');
    expect(attendanceDotClass('ABSENT')).toBe('bg-rose-500');
    expect(attendanceDotClass('PRESENT')).toBe('bg-emerald-500');
  });
});
