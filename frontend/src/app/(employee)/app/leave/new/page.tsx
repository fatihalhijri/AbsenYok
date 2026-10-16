import { ChevronLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LeaveForm } from '@/features/leave/components/leave-form';

export const metadata: Metadata = { title: 'Ajukan Izin' };

export default function NewLeavePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/app/leave"
          aria-label="Kembali ke daftar izin"
          className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeftIcon className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="text-xl font-semibold">Ajukan Izin / Cuti</h1>
      </div>
      <LeaveForm />
    </div>
  );
}
