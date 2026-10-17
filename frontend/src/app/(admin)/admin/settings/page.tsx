import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';
import { SettingsForm } from '@/features/settings/components/settings-form';

export const metadata: Metadata = { title: 'Pengaturan' };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Identitas instansi dan aturan absensi (khusus Super Admin)."
      />
      <SettingsForm />
    </div>
  );
}
