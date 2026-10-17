import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { DepartmentsView } from '@/features/master/components/departments-view';

export const metadata: Metadata = { title: 'Departemen' };

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Departemen" description="Kelompok karyawan untuk filter & laporan." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <DepartmentsView />
      </Suspense>
    </div>
  );
}
