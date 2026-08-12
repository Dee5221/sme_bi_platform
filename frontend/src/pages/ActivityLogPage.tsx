import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as auditApi from '../services/auditLogService';
import type { AuditLogEntry } from '../services/auditLogService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import './ActivityLogPage.css';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatAction(action: string) {
  return action.replace(/\./g, ' · ').replace(/_/g, ' ');
}

export function ActivityLogPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('audit.view');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadLogs = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view the activity log.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await auditApi.listAuditLogs({
        search: debouncedSearch || undefined,
        action: action || undefined,
        entity: entity || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        pageSize: 20,
      });
      setItems(result.items);
      setActions(result.filters.actions);
      setEntities(result.filters.entities);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load activity log.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, action, entity, startDate, endDate, page]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  if (!canView) {
    return <Alert tone="error">You do not have permission to view the activity log.</Alert>;
  }

  return (
    <div className="activity-log-page">
      <PageHeader
        title="Activity Log"
        subtitle="Review tenant-scoped account and system events for this business."
      />

      <Card>
        <div className="activity-log-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search actor, action, or entity"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <label className="activity-log-select">
            <span>Action</span>
            <select
              value={action}
              onChange={(e) => {
                setPage(1);
                setAction(e.target.value);
              }}
            >
              <option value="">All actions</option>
              {actions.map((item) => (
                <option key={item} value={item}>
                  {formatAction(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="activity-log-select">
            <span>Entity</span>
            <select
              value={entity}
              onChange={(e) => {
                setPage(1);
                setEntity(e.target.value);
              }}
            >
              <option value="">All entities</option>
              {entities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="From"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(e) => {
              setPage(1);
              setStartDate(e.target.value);
            }}
          />
          <Input
            label="To"
            name="endDate"
            type="date"
            value={endDate}
            onChange={(e) => {
              setPage(1);
              setEndDate(e.target.value);
            }}
          />
        </div>

        {loading ? (
          <LoadingSkeleton rows={8} />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <>
            <DataTable
              rows={items}
              rowKey={(row) => row.id}
              emptyTitle="No activity recorded"
              emptyDescription="Events will appear here as users work in this workspace."
              columns={[
                {
                  key: 'createdAt',
                  header: 'When',
                  render: (row) => formatDate(row.createdAt),
                },
                {
                  key: 'actor',
                  header: 'Actor',
                  render: (row) => (
                    <div>
                      <strong>{row.actorName}</strong>
                      {row.actorEmail ? (
                        <div className="activity-log-muted">{row.actorEmail}</div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: 'action',
                  header: 'Action',
                  render: (row) => <Badge tone="neutral">{formatAction(row.action)}</Badge>,
                },
                {
                  key: 'entity',
                  header: 'Entity',
                  render: (row) => row.entity,
                },
                {
                  key: 'entityId',
                  header: 'Record',
                  render: (row) => row.entityId || '—',
                },
              ]}
            />

            <div className="activity-log-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} events
              </span>
              <div className="activity-log-actions">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
