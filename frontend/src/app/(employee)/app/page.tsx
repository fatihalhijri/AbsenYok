import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Beranda' };

/** Kerangka beranda karyawan (start_url PWA) — layout & isi dikerjakan di FE-02/FE-04. */
export default function EmployeeHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-2xl font-semibold">Beranda Karyawan</h1>
      <p className="text-muted-foreground">Beranda sedang disiapkan.</p>
    </main>
  );
}
