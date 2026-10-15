import { CalendarCheck2Icon } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/shared/empty-state';

export const metadata: Metadata = { title: 'Beranda' };

/** Beranda karyawan (start_url PWA) — isi dikerjakan di FE-04. */
export default function EmployeeHomePage() {
  return (
    <EmptyState
      className="flex-1"
      icon={CalendarCheck2Icon}
      title="Beranda karyawan"
      description="Ringkasan absensi hari ini akan tampil di sini."
    />
  );
}
