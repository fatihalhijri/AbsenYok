'use client';

import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { attendanceAdminKeys } from '@/features/attendance/admin/api';
import { dashboardKeys } from '@/features/dashboard/api';
import type { Page } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/error';
import type { LeaveRequest, LeaveStatus } from '@/types';
import { leaveAdminApi, leaveAdminKeys } from './api';
import { applyReview, REVIEW_STATUS, type ReviewAction, reviewWithRollback } from './review';

export interface ReviewInput {
  ids: string[];
  action: ReviewAction;
  /** Wajib untuk tolak; opsional untuk setujui. */
  note?: string;
}

type Snapshot = [QueryKey, Page<LeaveRequest> | undefined][];

/** Filter status sebuah query daftar dari key-nya (`['leave','admin','list', query]`). */
const statusOfKey = (key: QueryKey): LeaveStatus | null => {
  const query = key[3];
  if (query && typeof query === 'object' && 'status' in query) {
    return (query as { status?: LeaveStatus }).status ?? null;
  }
  return null;
};

/**
 * Setujui/tolak satu atau banyak pengajuan dengan optimistic update di semua daftar admin
 * (tab, pratinjau dashboard, badge menu). Yang gagal di-rollback & diringkas dalam toast.
 */
export function useLeaveReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, action, note }: ReviewInput) => {
      const status = REVIEW_STATUS[action];
      // Daftar admin + pratinjau PENDING dashboard (key berbeda, bentuk Page yang sama).
      const filters = { queryKey: leaveAdminKeys.all };
      await queryClient.cancelQueries(filters);

      const outcome = await reviewWithRollback<Snapshot>({
        ids,
        request: (id) =>
          action === 'approve'
            ? leaveAdminApi.approve(id, note)
            : leaveAdminApi.reject(id, note ?? ''),
        cache: {
          snapshot: () => queryClient.getQueriesData<Page<LeaveRequest>>(filters),
          apply: (targets) => {
            for (const [key, data] of queryClient.getQueriesData<Page<LeaveRequest>>(filters)) {
              if (!data?.items) continue;
              const filterStatus =
                key[2] === dashboardKeys.pendingLeaves()[2] ? 'PENDING' : statusOfKey(key);
              queryClient.setQueryData(key, applyReview(data, targets, status, filterStatus));
            }
          },
          restore: (snapshot) => {
            for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
          },
        },
      });
      return { ...outcome, action };
    },
    onSuccess: ({ succeeded, failed, action }) => {
      const verb = action === 'approve' ? 'disetujui' : 'ditolak';
      if (failed.length === 0) {
        toast.success(
          succeeded.length === 1 ? `Pengajuan ${verb}` : `${succeeded.length} pengajuan ${verb}`,
        );
      } else {
        const message = getErrorMessage(failed[0]?.error);
        if (succeeded.length > 0) {
          toast.warning(`${succeeded.length} pengajuan ${verb}, ${failed.length} gagal`, {
            description: message,
          });
        } else {
          toast.error(
            failed.length === 1 ? 'Gagal memproses pengajuan' : `${failed.length} pengajuan gagal`,
            { description: message },
          );
        }
      }
    },
    onError: (error) =>
      toast.error('Gagal memproses pengajuan', { description: getErrorMessage(error) }),
    onSettled: async () => {
      // Sinkronkan dengan server: daftar izin, dashboard (izin/cuti hari ini) & absensi
      // (persetujuan mengonversi hari kerja menjadi SICK/PERMIT/LEAVE).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leaveAdminKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
        queryClient.invalidateQueries({ queryKey: attendanceAdminKeys.all }),
      ]);
    },
  });
}
