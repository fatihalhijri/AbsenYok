import type { Metadata } from 'next';
import { ScanView } from '@/features/attendance/scan/scan-view';

export const metadata: Metadata = { title: 'Scan Absen' };

export default function ScanPage() {
  return <ScanView />;
}
