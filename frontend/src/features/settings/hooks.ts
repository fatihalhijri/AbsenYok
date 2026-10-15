'use client';

import { useQuery } from '@tanstack/react-query';
import { env } from '@/lib/env';
import { settingsApi, settingsKeys } from './api';

/** Nama & logo instansi (fallback ke nama aplikasi selama dimuat/gagal). */
export function usePublicSettings() {
  const query = useQuery({
    queryKey: settingsKeys.public(),
    queryFn: settingsApi.getPublic,
    staleTime: 5 * 60_000,
  });
  return {
    ...query,
    companyName: query.data?.companyName || env.NEXT_PUBLIC_APP_NAME,
    logoUrl: query.data?.logoUrl || null,
  };
}
