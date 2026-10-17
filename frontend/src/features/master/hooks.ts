'use client';

import { useQuery } from '@tanstack/react-query';
import { departmentsApi, LOOKUP_QUERY, locationsApi, masterKeys, shiftsApi } from './api';

/** Data pilihan dropdown (≤ 100 item, jarang berubah). */
const LOOKUP_STALE_MS = 5 * 60_000;

export function useDepartmentOptions() {
  return useQuery({
    queryKey: masterKeys.departmentList(LOOKUP_QUERY),
    queryFn: () => departmentsApi.list(LOOKUP_QUERY),
    staleTime: LOOKUP_STALE_MS,
    select: (page) => page.items.map((item) => ({ value: item.id, label: item.name })),
  });
}

export function useShiftOptions() {
  return useQuery({
    queryKey: masterKeys.shiftList(LOOKUP_QUERY),
    queryFn: () => shiftsApi.list(LOOKUP_QUERY),
    staleTime: LOOKUP_STALE_MS,
    select: (page) =>
      page.items.map((item) => ({
        value: item.id,
        label: `${item.name} (${item.startTime}–${item.endTime})`,
        disabled: !item.isActive,
      })),
  });
}

export function useLocationOptions() {
  return useQuery({
    queryKey: masterKeys.locationList(LOOKUP_QUERY),
    queryFn: () => locationsApi.list(LOOKUP_QUERY),
    staleTime: LOOKUP_STALE_MS,
    select: (page) =>
      page.items.map((item) => ({ value: item.id, label: item.name, disabled: !item.isActive })),
  });
}
