import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as recordApi from '../services/supplierPortalRecordService';
import type { SupplierPurchaseRecord } from '../services/supplierPortalRecordService';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import './SalesPage.css';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function SupplierPurchaseHistoryPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('portal.history.view');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<SupplierPurchaseRecord[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedRecord, setSelectedRecord] = useState<SupplierPurchaseRecord | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadRecords = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view purchase history.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await recordApi.listSupplierRecords({
        search: debouncedSearch || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: 20,
      });
      setRecords(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load purchase history.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, from, to, page]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setFrom('');
    setTo('');
    setPage(1);
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view purchase history.</Alert>;
  }

  return (
    <div className="sales-page">
      <Link className="sales-back" to="/app/portal/records">
        ← Back to purchase records
      </Link>
      <PageHeader
        title="Purchase history"
        subtitle="Look up past stock-in deliveries by date, product, SKU, or reason."
      />

      <Card>
        <div className="sales-history-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search product, SKU, or reason"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <Input
            label="From"
            name="from"
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
          />
          <Input
            label="To"
            name="to"
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
          />
          <Button type="button" variant="secondary" onClick={clearFilters}>
            Clear
          </Button>
        </div>

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <>
            <DataTable
              rows={records}
              rowKey={(row) => row.id}
              emptyTitle="No records in this period"
              emptyDescription="Adjust the date range or search to find earlier deliveries."
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  render: (row) => (
                    <div>
                      <strong>{row.productName}</strong>
                      <div className="sales-muted">{row.productSku}</div>
                    </div>
                  ),
                },
                {
                  key: 'quantity',
                  header: 'Units',
                  render: (row) => row.quantity,
                },
                {
                  key: 'recorded',
                  header: 'Recorded',
                  render: (row) => formatDate(row.createdAt),
                },
                {
                  key: 'reason',
                  header: 'Reason',
                  render: (row) => row.reason || '—',
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row) => (
                    <Button variant="ghost" onClick={() => setSelectedRecord(row)}>
                      View
                    </Button>
                  ),
                },
              ]}
            />

            <div className="sales-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} records
              </span>
              <div className="sales-actions">
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

      <Modal
        open={Boolean(selectedRecord)}
        title={selectedRecord ? selectedRecord.productName : 'Purchase record'}
        onClose={() => setSelectedRecord(null)}
        width="lg"
      >
        {selectedRecord ? (
          <div className="sales-detail">
            <p>
              <strong>SKU:</strong> {selectedRecord.productSku}
            </p>
            <p>
              <strong>Recorded:</strong> {formatDate(selectedRecord.createdAt)}
            </p>
            <p>
              <strong>Units delivered:</strong> {selectedRecord.quantity}
            </p>
            <p>
              <strong>Stock before:</strong> {selectedRecord.quantityBefore}
            </p>
            <p>
              <strong>Stock after:</strong> {selectedRecord.quantityAfter}
            </p>
            {selectedRecord.reason ? (
              <p>
                <strong>Reason:</strong> {selectedRecord.reason}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
