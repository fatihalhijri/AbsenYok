import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';
import { PersonalScanView } from '@/features/attendance/personal-scan/personal-scan-view';

export const metadata: Metadata = { title: 'Scan QR Personal' };

export default function ScanPersonalPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan QR Personal"
        description="Mode cadangan: pindai QR personal karyawan bila kiosk tidak tersedia."
      />
      <PersonalScanView />
    </div>
  );
}
