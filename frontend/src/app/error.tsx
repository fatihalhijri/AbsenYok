'use client';

import { RouteError } from '@/components/shared/route-error';

/** Error boundary umum (login, offline, dan segmen tanpa error.tsx sendiri). */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RouteError error={error} retry={retry} homeHref="/login" homeLabel="Ke halaman login" />;
}
