import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HistoryView } from '@/features/attendance/history/history-view';

export const metadata: Metadata = { title: 'Riwayat' };

export default function HistoryPage() {
  return (
    // `?month=` dibaca lewat useSearchParams → wajib di dalam Suspense (Cache Components).
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <HistoryView />
    </Suspense>
  );
}
