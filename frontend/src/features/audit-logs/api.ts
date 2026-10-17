import type { ListQuery } from '@/features/master/api';
import { api } from '@/lib/api-client';
import type { AuditLog } from '@/types';

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  list: (query: ListQuery) => [...auditLogKeys.all, 'list', query] as const,
};

export const auditLogsApi = {
  /** SUPER_ADMIN · filter `action, actorId, entity, entityId, dateFrom, dateTo`, `search` aktor. */
  list: (query: ListQuery) => api.page<AuditLog>('/audit-logs', query),
};
