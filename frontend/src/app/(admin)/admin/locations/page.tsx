import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { LocationsView } from '@/features/master/components/locations-view';

export const metadata: Metadata = { title: 'Lokasi' };

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lokasi"
        description="Titik kantor & radius geofence untuk validasi lokasi saat absen."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <LocationsView />
      </Suspense>
    </div>
  );
}
