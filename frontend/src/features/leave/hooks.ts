'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceKeys } from '@/features/attendance/api';
import { type CreateLeaveInput, leaveApi, leaveKeys } from './api';

export function useMyLeaves() {
  return useQuery({ queryKey: leaveKeys.mine(), queryFn: leaveApi.mine });
}

export function useLeaveQuota(year: number | null) {
  return useQuery({
    queryKey: leaveKeys.quota(year ?? 0),
    queryFn: () => leaveApi.quota(year ?? 0),
    enabled: year !== null,
  });
}

/** Setelah pengajuan berubah: daftar, kuota, dan status absensi (izin disetujui) dimuat ulang. */
function useInvalidateLeave() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: leaveKeys.all }),
      queryClient.invalidateQueries({ queryKey: attendanceKeys.mine() }),
    ]);
}

export function useCancelLeave() {
  const invalidate = useInvalidateLeave();
  return useMutation({ mutationFn: leaveApi.cancel, onSuccess: invalidate });
}

export function useCreateLeave(onProgress?: (percent: number) => void) {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: (input: CreateLeaveInput) => leaveApi.create(input, onProgress),
    onSuccess: invalidate,
  });
}
