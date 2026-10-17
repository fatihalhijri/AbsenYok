'use client';

import { AlertTriangleIcon, HomeIcon, RotateCcwIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RouteErrorProps {
  error: Error & { digest?: string };
  /** `retry` dari error boundary Next.js: ambil ulang data & render ulang segmen. */
  retry: () => void;
  /** Tujuan tombol kembali (beranda segmen). */
  homeHref?: string;
  homeLabel?: string;
  className?: string;
}

/**
 * Tampilan error per segmen (error.tsx). Pesan teknis tidak ditampilkan ke pengguna — hanya kode
 * `digest` (cocok dengan log server) untuk dilaporkan ke admin.
 */
export function RouteError({
  error,
  retry,
  homeHref = '/',
  homeLabel = 'Ke beranda',
  className,
}: RouteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center',
        className,
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangleIcon className="size-8" aria-hidden="true" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold">Terjadi kesalahan</h1>
        <p className="text-muted-foreground">
          Halaman ini gagal dimuat. Coba lagi — bila masih bermasalah, hubungi admin.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">Kode: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={retry} className="min-h-11">
          <RotateCcwIcon aria-hidden="true" />
          Coba lagi
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={homeHref}>
            <HomeIcon aria-hidden="true" />
            {homeLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
}
