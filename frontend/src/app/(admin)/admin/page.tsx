import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';
import { AttendanceTrend } from '@/features/dashboard/components/attendance-trend';
import {
  LateRankingCard,
  PendingLeavesCard,
  RecentActivityCard,
} from '@/features/dashboard/components/dashboard-widgets';
import { SummaryCards } from '@/features/dashboard/components/summary-cards';
import { TodayComposition } from '@/features/dashboard/components/today-composition';

export const metadata: Metadata = { title: 'Dashboard' };

/** Dashboard admin — setiap widget memuat datanya sendiri (skeleton masing-masing). */
export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Ringkasan kehadiran hari ini." />
      <SummaryCards />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AttendanceTrend />
        </div>
        <TodayComposition />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <LateRankingCard />
        <RecentActivityCard />
        <PendingLeavesCard />
      </div>
    </div>
  );
}
