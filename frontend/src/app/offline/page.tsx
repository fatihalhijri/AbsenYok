import { WifiOffIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { RetryButton } from './retry-button';

export const metadata: Metadata = { title: 'Offline' };

/**
 * Fallback service worker saat navigasi gagal karena tidak ada koneksi. Halaman ini statis dan
 * di-precache — jangan memuat data user di sini.
 */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <WifiOffIcon className="size-8" aria-hidden="true" />
      </div>
      <div className="max-w-sm space-y-2">
        <h1 className="text-2xl font-semibold">Anda sedang offline</h1>
        <p className="text-muted-foreground">
          Periksa koneksi internet Anda. Absensi membutuhkan koneksi agar QR Code dan lokasi dapat
          diverifikasi server.
        </p>
      </div>
      <RetryButton />
    </main>
  );
}
