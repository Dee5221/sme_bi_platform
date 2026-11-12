import { apiRequest } from '../lib/api';

export type AuditLogEntry = {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  result: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_name: string;
  actor_email: string | null;
};

type Paginated = {
  items: AuditLogEntry[];
  filters: {
    actions: string[];
    entities: string[];
  };
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
  retention_days: number;
  note: string;
};

export function listAuditLogs(params: {
  search?: string;
  action?: string;
  entity?: string;
  result?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.action) query.set('action', params.action);
  if (params.entity) query.set('entity', params.entity);
  if (params.result) query.set('result', params.result);
  if (params.startDate) query.set('start_date', params.startDate);
  if (params.endDate) query.set('end_date', params.endDate);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('page_size', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<Paginated>(`/api/audit-logs/${suffix}`);
}
