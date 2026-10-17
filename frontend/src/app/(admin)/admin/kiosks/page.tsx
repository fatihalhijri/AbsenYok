import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { KioskList } from '@/features/kiosk/components/kiosk-list';

export const metadata: Metadata = { title: 'Kiosk' };

export default function KiosksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Kiosk"
        description="Layar QR dinamis di pintu masuk. Buka layar kiosk di tablet/TV lalu login sekali dengan akun admin."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <KioskList />
      </Suspense>
    </div>
  );
}
