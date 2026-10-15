'use client';

import { useQuery } from '@tanstack/react-query';
import { holidayKeys, holidaysApi } from './api';

/** Hari libur setahun — jarang berubah, simpan lama di cache. */
export function useHolidays(year: number | null) {
  return useQuery({
    queryKey: holidayKeys.year(year ?? 0),
    queryFn: () => holidaysApi.list(year ?? 0),
    enabled: year !== null,
    staleTime: 60 * 60_000,
  });
}
