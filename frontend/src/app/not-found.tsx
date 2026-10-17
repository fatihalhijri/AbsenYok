import { CompassIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Halaman tidak ditemukan' };

/** 404 untuk seluruh aplikasi (rute tidak dikenal & `notFound()`). */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CompassIcon className="size-8" aria-hidden="true" />
      </div>
      <div className="max-w-md space-y-2">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
        <p className="text-muted-foreground">
          Alamat yang Anda buka tidak ada atau sudah dipindahkan.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild className="min-h-11">
          <Link href="/app">Beranda karyawan</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/admin">Dashboard admin</Link>
        </Button>
      </div>
    </main>
  );
}
