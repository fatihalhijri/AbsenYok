import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/shared/page-header';
import { RenderWhenVisible } from '@/components/shared/render-when-visible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LateRankingCard,
  PendingLeavesCard,
  RecentActivityCard,
} from '@/features/dashboard/components/dashboard-widgets';
import { SummaryCards } from '@/features/dashboard/components/summary-cards';

// Grafik (recharts ±330 KB) dipisah ke chunk sendiri dan baru dipasang saat mendekati viewport
// (di HP letaknya di bawah lipatan) → kartu ringkasan tampil & interaktif lebih dulu.
const chartSkeleton = () => <Skeleton className="h-[26rem] w-full rounded-xl" />;
const AttendanceTrend = dynamic(
  () => import('@/features/dashboard/components/attendance-trend').then((m) => m.AttendanceTrend),
  { loading: chartSkeleton },
);
const TodayComposition = dynamic(
  () => import('@/features/dashboard/components/today-composition').then((m) => m.TodayComposition),
  { loading: chartSkeleton },
);

export const metadata: Metadata = { title: 'Dashboard' };

/** Dashboard admin — setiap widget memuat datanya sendiri (skeleton masing-masing). */
export default function AdminDashboardPage() {
  return (
    // Di HP grafik dipindah ke paling bawah (order-last): angka & daftar tampil lebih dulu dan
    // recharts tidak dipasang saat halaman dibuka. Desktop (xl) tetap urutan semula.
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Ringkasan kehadiran hari ini." />
      <SummaryCards />
      <div className="order-last grid gap-6 xl:order-none xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RenderWhenVisible fallback={chartSkeleton()}>
            <AttendanceTrend />
          </RenderWhenVisible>
        </div>
        <RenderWhenVisible fallback={chartSkeleton()}>
          <TodayComposition />
        </RenderWhenVisible>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <LateRankingCard />
        <RecentActivityCard />
        <PendingLeavesCard />
      </div>
    </div>
  );
}
