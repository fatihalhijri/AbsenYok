import { LayoutDashboardIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';

export const metadata: Metadata = { title: 'Dashboard' };

/** Dashboard admin — statistik & grafik dikerjakan di FE-08. */
export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Ringkasan kehadiran hari ini." />
      <EmptyState
        icon={LayoutDashboardIcon}
        title="Dashboard sedang disiapkan"
        description="Statistik kehadiran, tren, dan aktivitas terbaru akan tampil di sini."
      />
    </>
  );
}
