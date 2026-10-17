import type { ListQuery } from '@/features/master/api';
import { api } from '@/lib/api-client';
import type { LeaveRequest } from '@/types';

/**
 * Prefix `['leave', 'admin']` — juga menaungi pratinjau PENDING di dashboard & badge menu
 * (`dashboardKeys.pendingLeaves`), sehingga satu invalidasi menyegarkan semuanya.
 */
export const leaveAdminKeys = {
  all: ['leave', 'admin'] as const,
  lists: () => [...leaveAdminKeys.all, 'list'] as const,
  list: (query: ListQuery) => [...leaveAdminKeys.lists(), query] as const,
};

export const leaveAdminApi = {
  list: (query: ListQuery) => api.page<LeaveRequest>('/leave-requests', query),
  approve: (id: string, note?: string) =>
    api.patch<LeaveRequest>(`/leave-requests/${id}/approve`, note ? { note } : {}),
  reject: (id: string, note: string) =>
    api.patch<LeaveRequest>(`/leave-requests/${id}/reject`, { note }),
};
