import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceView } from '@/features/attendance/admin/attendance-view';

export const metadata: Metadata = { title: 'Absensi' };

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Absensi"
        description="Pantau absensi karyawan, lihat detail scan, koreksi, atau tambah absensi manual."
      />
      {/* Filter & halaman disimpan di URL (useSearchParams) → wajib Suspense. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <AttendanceView />
      </Suspense>
    </div>
  );
}
