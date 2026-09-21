import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as saleApi from '../services/saleService';
import type { Sale, SaleList } from '../services/saleService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
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
  const { pushToast } = useToast();
  const canView = hasPermission('sales.view');
  const canCreate = hasPermission('sales.create');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleList[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadSales = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view sales.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await saleApi.listSales({
        from: undefined,
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
  }, [canView, page]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  async function handleViewSale(saleId: number) {
    setLoadingDetail(true);
    try {
      const fullSale = await saleApi.getSale(saleId);
      setSelectedSale(fullSale);
    } catch (err) {
      pushToast('Failed to load sale details.', 'error');
    } finally {
      setLoadingDetail(false);
    }
  }

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
            placeholder="Search sale ID, notes, or customer"
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
              rowKey={(row) => String(row.id)}
              emptyTitle="No sales yet"
              emptyDescription="Record a sale to start today's transaction list."
              columns={[
                {
                  key: 'number',
                  header: 'Sale',
                  render: (row) => (
                    <div>
                      <strong>#{row.id}</strong>
                      <div className="sales-muted">{formatDate(row.sale_datetime)}</div>
                    </div>
                  ),
                },
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (row) => row.customer_name || 'Walk-in',
                },
                {
                  key: 'items',
                  header: 'Items',
                  render: (row) => row.item_count,
                },
                {
                  key: 'total',
                  header: 'Total',
                  render: (row) => formatMoney(row.total_amount),
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
                    <Button 
                      variant="ghost" 
                      onClick={() => handleViewSale(row.id)}
                      disabled={loadingDetail}
                    >
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
        title={selectedSale ? `Sale #${selectedSale.id}` : 'Sale'}
        onClose={() => setSelectedSale(null)}
        width="lg"
      >
        {selectedSale ? (
          <div className="sales-detail">
            <p>
              <strong>Customer:</strong> {selectedSale.customer_name || 'Walk-in'}
            </p>
            <p>
              <strong>Sold:</strong> {formatDate(selectedSale.sale_datetime)}
            </p>
            <p>
              <strong>Recorded by:</strong> {selectedSale.user_name || '—'}
            </p>
            {selectedSale.payment_method ? (
              <p>
                <strong>Payment:</strong> {selectedSale.payment_method}
              </p>
            ) : null}
            <DataTable
              rows={selectedSale.items}
              rowKey={(row) => String(row.id)}
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  render: (row) => `${row.product_name} (${row.sku})`,
                },
                {
                  key: 'price',
                  header: 'Unit price',
                  render: (row) => formatMoney(row.unit_price),
                },
                {
                  key: 'qty',
                  header: 'Qty',
                  render: (row) => row.quantity,
                },
                {
                  key: 'line',
                  header: 'Subtotal',
                  render: (row) => formatMoney(row.subtotal),
                },
              ]}
            />
            <div className="sales-detail__total">
              Total: <strong>{formatMoney(selectedSale.total_amount)}</strong>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}