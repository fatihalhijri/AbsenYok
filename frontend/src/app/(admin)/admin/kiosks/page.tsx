import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';
import { KioskList } from '@/features/kiosk/components/kiosk-list';

export const metadata: Metadata = { title: 'Kiosk' };

export default function KiosksPage() {
  return (
    <>
      <PageHeader
        title="Kiosk"
        description="Layar QR dinamis di pintu masuk. Buka layar kiosk di tablet/TV lalu login sekali dengan akun admin."
      />
      <KioskList />
    </>
  );
}
