'use client';

import { RouteError } from '@/components/shared/route-error';

/** Error di area admin: sidebar & topbar (layout) tetap tampil, hanya konten yang diganti. */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RouteError error={error} retry={retry} homeHref="/admin" homeLabel="Ke dashboard" />;
}
