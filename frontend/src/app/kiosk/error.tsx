'use client';

import { useEffect } from 'react';
import { RouteError } from '@/components/shared/route-error';

/** Kiosk berjalan tanpa operator → coba pulih otomatis tiap 15 detik. */
const AUTO_RETRY_MS = 15_000;

export default function KioskError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(retry, AUTO_RETRY_MS);
    return () => clearTimeout(timer);
  }, [retry]);

  return (
    <RouteError
      error={error}
      retry={retry}
      homeHref="/admin/kiosks"
      homeLabel="Daftar kiosk"
      className="min-h-dvh"
    />
  );
}
