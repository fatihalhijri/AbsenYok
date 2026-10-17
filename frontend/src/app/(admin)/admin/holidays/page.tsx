import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { HolidaysView } from '@/features/master/components/holidays-view';

export const metadata: Metadata = { title: 'Hari Libur' };

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hari Libur"
        description="Hari libur nasional & kantor — tidak dihitung sebagai hari kerja."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <HolidaysView />
      </Suspense>
    </div>
  );
}
