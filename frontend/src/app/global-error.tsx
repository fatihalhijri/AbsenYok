'use client';

import './globals.css';

/**
 * Error di root layout (mis. provider gagal). Menggantikan seluruh dokumen → harus memuat
 * `<html>`/`<body>` & CSS sendiri; tanpa komponen yang bergantung pada provider aplikasi.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="id">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground antialiased">
        <title>Terjadi kesalahan · AbsenYok</title>
        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-semibold">Aplikasi gagal dimuat</h1>
          <p className="text-muted-foreground">
            Muat ulang halaman. Bila masih bermasalah, hubungi admin.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">Kode: {error.digest}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={retry}
          className="min-h-11 rounded-lg bg-primary px-5 font-medium text-primary-foreground"
        >
          Coba lagi
        </button>
      </body>
    </html>
  );
}
