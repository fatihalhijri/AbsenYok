import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmployeesView } from '@/features/employees/components/employees-view';

export const metadata: Metadata = { title: 'Karyawan' };

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Karyawan"
        description="Kelola akun karyawan, shift, lokasi, dan perangkat."
      />
      {/* State tabel disimpan di URL (useSearchParams) → wajib Suspense. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <EmployeesView />
      </Suspense>
    </div>
  );
}
