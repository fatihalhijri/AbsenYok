import { api } from '@/lib/api-client';
import type {
  DashboardSummary,
  LateRanking,
  LeaveRequest,
  RecentActivity,
  TrendPoint,
} from '@/types';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  trend: (days: number) => [...dashboardKeys.all, 'trend', days] as const,
  lateRanking: (month: string) => [...dashboardKeys.all, 'late-ranking', month] as const,
  activity: () => [...dashboardKeys.all, 'activity'] as const,
  pendingLeaves: () => ['leave', 'admin', 'pending-preview'] as const,
};

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
  trend: (days = 30) => api.get<TrendPoint[]>('/dashboard/trend', { days }),
  lateRanking: (month: string) => api.get<LateRanking[]>('/dashboard/late-ranking', { month }),
  activity: () => api.get<RecentActivity[]>('/dashboard/recent-activity'),
  /** 5 pengajuan PENDING terbaru + total (meta). */
  pendingLeaves: () =>
    api.page<LeaveRequest>('/leave-requests', {
      status: 'PENDING',
      limit: 5,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
};
