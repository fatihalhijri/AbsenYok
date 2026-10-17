import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { MonthlyReportView } from '@/features/reports/components/monthly-report-view';

export const metadata: Metadata = { title: 'Rekap & Export' };

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap & Export"
        description="Rekap kehadiran bulanan per karyawan, unduh Excel/PDF."
      />
      {/* Bulan & departemen disimpan di URL (useSearchParams) → wajib Suspense. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <MonthlyReportView />
      </Suspense>
    </div>
  );
}
