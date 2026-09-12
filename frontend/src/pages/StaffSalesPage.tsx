import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as saleApi from '../services/saleService';
import type { Sale } from '../services/saleService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import './SalesPage.css';

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function StaffSalesPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('sales.view');
  const canCreate = hasPermission('sales.create');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadSales = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view sales.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await saleApi.listSales({
        search: debouncedSearch || undefined,
        page,
        pageSize: 20,
      });
      setSales(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load sales.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, page]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  if (!canView) {
    return <Alert tone="error">You do not have permission to view sales.</Alert>;
  }

  return (
    <div className="sales-page">
      <PageHeader
        title="Sales"
        subtitle="Review recent transactions and record a new sale for this business."
        actions={
          <>
            <Link className="ui-btn ui-btn--secondary" to="/app/sales/history">
              Sales history
            </Link>
            {canCreate ? (
              <Link className="ui-btn ui-btn--primary" to="/app/sales/new">
                New sale
              </Link>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="sales-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search sale number, notes, or customer"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <>
            <DataTable
              rows={sales}
              rowKey={(row) => row.id}
              emptyTitle="No sales yet"
              emptyDescription="Record a sale to start today's transaction list."
              columns={[
                {
                  key: 'number',
                  header: 'Sale',
                  render: (row) => (
                    <div>
                      <strong>{row.saleNumber}</strong>
                      <div className="sales-muted">{formatDate(row.soldAt)}</div>
                    </div>
                  ),
                },
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (row) => row.customer?.name || 'Walk-in',
                },
                {
                  key: 'items',
                  header: 'Items',
                  render: (row) => row.items.length,
                },
                {
                  key: 'total',
                  header: 'Total',
                  render: (row) => formatMoney(row.total),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => <Badge tone="green">{row.status}</Badge>,
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row) => (
                    <Button variant="ghost" onClick={() => setSelectedSale(row)}>
                      View
                    </Button>
                  ),
                },
              ]}
            />

            <div className="sales-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} sales
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
        open={Boolean(selectedSale)}
        title={selectedSale ? selectedSale.saleNumber : 'Sale'}
        onClose={() => setSelectedSale(null)}
        width="lg"
      >
        {selectedSale ? (
          <div className="sales-detail">
            <p>
              <strong>Customer:</strong> {selectedSale.customer?.name || 'Walk-in'}
            </p>
            <p>
              <strong>Sold:</strong> {formatDate(selectedSale.soldAt)}
            </p>
            <p>
              <strong>Recorded by:</strong> {selectedSale.createdBy?.name || '—'}
            </p>
            {selectedSale.notes ? (
              <p>
                <strong>Notes:</strong> {selectedSale.notes}
              </p>
            ) : null}
            <DataTable
              rows={selectedSale.items}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  render: (row) => `${row.productName} (${row.productSku})`,
                },
                {
                  key: 'price',
                  header: 'Unit price',
                  render: (row) => formatMoney(row.unitPrice),
                },
                {
                  key: 'qty',
                  header: 'Qty',
                  render: (row) => row.quantity,
                },
                {
                  key: 'line',
                  header: 'Line total',
                  render: (row) => formatMoney(row.lineTotal),
                },
              ]}
            />
            <div className="sales-detail__total">
              Total: <strong>{formatMoney(selectedSale.total)}</strong>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
