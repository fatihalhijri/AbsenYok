import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ShiftsView } from '@/features/master/components/shifts-view';

export const metadata: Metadata = { title: 'Shift' };

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift"
        description="Jam kerja, toleransi terlambat, jendela absen, dan hari kerja."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ShiftsView />
      </Suspense>
    </div>
  );
}
