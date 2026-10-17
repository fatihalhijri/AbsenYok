'use client';

import { RouteError } from '@/components/shared/route-error';

/** Error di area karyawan: bottom nav (layout) tetap tampil, hanya konten yang diganti. */
export default function EmployeeError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RouteError error={error} retry={retry} homeHref="/app" homeLabel="Ke beranda" />;
}
