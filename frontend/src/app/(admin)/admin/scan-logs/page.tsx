import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ScanLogsView } from '@/features/scan-logs/scan-logs-view';

export const metadata: Metadata = { title: 'Log Scan' };

export default function ScanLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Log Scan"
        description="Semua percobaan scan absensi — telusuri kegagalan & pola mencurigakan."
      />
      {/* Filter disimpan di URL (useSearchParams) → wajib Suspense. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ScanLogsView />
      </Suspense>
    </div>
  );
}
