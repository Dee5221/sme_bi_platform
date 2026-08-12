import { apiRequest } from '../lib/api';

export type AuditLogEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: string | null;
  createdAt: string;
  actorName: string;
  actorEmail: string | null;
};

type Paginated<T> = {
  items: T[];
  filters: {
    actions: string[];
    entities: string[];
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function listAuditLogs(params: {
  search?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.action) query.set('action', params.action);
  if (params.entity) query.set('entity', params.entity);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<Paginated<AuditLogEntry>>(`/api/audit-logs${suffix}`);
}
