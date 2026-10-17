import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { AuditLogsView } from '@/features/audit-logs/audit-logs-view';

export const metadata: Metadata = { title: 'Audit Log' };

export default function AuditLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Jejak aksi penting: login, perubahan akun, koreksi absensi, approval, pengaturan."
      />
      {/* Filter disimpan di URL (useSearchParams) → wajib Suspense. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <AuditLogsView />
      </Suspense>
    </div>
  );
}
