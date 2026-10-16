import type { Metadata } from 'next';
import { MyQrView } from '@/features/profile/my-qr/my-qr-view';

export const metadata: Metadata = { title: 'QR Personal' };

export default function MyQrPage() {
  return <MyQrView />;
}
