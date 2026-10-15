import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Masuk' };

/** Kerangka halaman login — form & autentikasi dikerjakan di FE-03. */
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-2xl font-semibold">Masuk ke AbsenYok</h1>
      <p className="text-muted-foreground">Halaman login sedang disiapkan.</p>
    </main>
  );
}
