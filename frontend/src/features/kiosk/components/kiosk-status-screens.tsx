'use client';

import { LogInIcon, ShieldOffIcon, WifiOffIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useNow } from '@/hooks/use-now';
import { loginPathWithNext } from '@/features/auth/routing';
import { cn } from '@/lib/utils';

/** Overlay saat koneksi ke server terputus. QR TIDAK ditampilkan selama overlay aktif. */
export function ConnectionOverlay({
  retryAt,
  className,
}: {
  /** Jam perangkat percobaan berikutnya (null = menunggu jaringan kembali). */
  retryAt: number | null;
  className?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="connection-overlay"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-8 text-center text-amber-50',
        className,
      )}
    >
      <WifiOffIcon className="size-16 animate-pulse text-amber-300" aria-hidden="true" />
      <p className="text-2xl font-semibold lg:text-3xl">
        Koneksi terputus, mencoba menghubungkan kembali…
      </p>
      <RetryCountdown retryAt={retryAt} />
      <p className="max-w-md text-base text-amber-100/80">
        QR disembunyikan sampai koneksi pulih. Bila berlangsung lama, karyawan dapat absen lewat QR
        personal yang dipindai petugas.
      </p>
    </div>
  );
}

function RetryCountdown({ retryAt }: { retryAt: number | null }) {
  const now = useNow(1000);
  if (retryAt === null || now === null) {
    return <p className="text-lg text-amber-200">Menunggu jaringan tersedia…</p>;
  }
  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return (
    <p className="text-lg text-amber-200 tabular-nums">
      {seconds > 0 ? `Mencoba lagi dalam ${seconds} detik` : 'Menghubungkan…'}
    </p>
  );
}

/** Sesi admin di perangkat kiosk ditolak server (refresh gagal / dicabut). */
export function SessionEndedScreen({ nextPath }: { nextPath: string }) {
  return (
    <div
      role="alert"
      data-testid="session-ended"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center"
    >
      <span className="flex size-24 items-center justify-center rounded-3xl bg-destructive/15 text-destructive">
        <ShieldOffIcon className="size-12" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold lg:text-4xl">Sesi kiosk berakhir</h1>
        <p className="text-lg text-muted-foreground">
          Silakan login ulang dengan akun admin untuk menampilkan QR absensi kembali.
        </p>
      </div>
      <Button asChild size="lg" className="h-14 px-8 text-lg">
        <Link href={loginPathWithNext(nextPath)}>
          <LogInIcon className="size-5" aria-hidden="true" />
          Login ulang
        </Link>
      </Button>
    </div>
  );
}
