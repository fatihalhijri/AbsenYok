import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { LeaveRequestsView } from '@/features/leave/admin/leave-requests-view';

export const metadata: Metadata = { title: 'Izin & Cuti' };

export default function LeaveRequestsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Izin & Cuti"
        description="Setujui atau tolak pengajuan karyawan — bisa sekaligus banyak."
      />
      {/* Tab & filter disimpan di URL (useSearchParams) → wajib Suspense. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <LeaveRequestsView />
      </Suspense>
    </div>
  );
}
