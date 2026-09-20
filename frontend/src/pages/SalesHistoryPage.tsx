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

export function SalesHistoryPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();
  const canView = hasPermission('sales.view');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleList[]>([]);
  const [search, setSearch] = useState('');
  // const [debouncedSearch, setDebouncedSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Debounced search — currently disabled because the backend does not
  // support a `search` param on listSales. Re-enable this block and the
  // commented-out `search:` field in the listSales call below if/when
  // the backend adds support.
  //
  // useEffect(() => {
  //   const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
  //   return () => window.clearTimeout(timer);
  // }, [search]);

  const loadSales = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view sales history.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await saleApi.listSales({
        // search: debouncedSearch || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: 20,
      });
      setSales(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load sales history.');
    } finally {
      setLoading(false);
    }
  }, [canView, from, to, page]);
  // Note: `debouncedSearch` was previously in the deps array above; it is
  // intentionally omitted now that the search param is disabled.

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  function clearFilters() {
    setSearch('');
    // setDebouncedSearch('');
    setFrom('');
    setTo('');
    setPage(1);
  }

  async function handleViewSale(saleId: number) {
    setLoadingDetail(true);
    try {
      const sale = await saleApi.getSale(saleId);
      setSelectedSale(sale);
    } catch (err) {
      pushToast('Failed to load sale details.', 'error');
    } finally {
      setLoadingDetail(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view sales history.</Alert>;
  }

  return (
    <div className="sales-page">
      <Link className="sales-back" to="/app/sales">
        ← Back to sales
      </Link>
      <PageHeader
        title="Sales history"
        subtitle="Look up past transactions by date or customer."
      />

      <Card>
        <div className="sales-history-toolbar">
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
              rows={sales}
              rowKey={(row) => row.id}
              emptyTitle="No sales in this period"
              emptyDescription="Adjust the date range to find earlier transactions."
              columns={[
                {
                  key: 'number',
                  header: 'Sale ID',
                  render: (row: SaleList) => (
                    <div>
                      <strong>#{row.id}</strong>
                      <div className="sales-muted">{formatDate(row.sale_datetime)}</div>
                    </div>
                  ),
                },
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (row: SaleList) => row.customer_name || 'Walk-in',
                },
                {
                  key: 'recordedBy',
                  header: 'Recorded by',
                  render: (row: SaleList) => row.user_name || '—',
                },
                {
                  key: 'items',
                  header: 'Items',
                  render: (row: SaleList) => row.item_count,
                },
                {
                  key: 'total',
                  header: 'Total',
                  render: (row: SaleList) => formatMoney(row.total_amount),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row: SaleList) => <Badge tone="green">{row.status}</Badge>,
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row: SaleList) => (
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
            <p><strong>Sale ID:</strong> #{selectedSale.id}</p>
            <p><strong>Customer:</strong> {selectedSale.customer_name || 'Walk-in'}</p>
            <p><strong>Date:</strong> {formatDate(selectedSale.sale_datetime)}</p>
            <p><strong>Recorded by:</strong> {selectedSale.user_name || '—'}</p>
            <p><strong>Payment:</strong> {selectedSale.payment_method}</p>

            <DataTable
              rows={selectedSale.items}
              rowKey={(row) => row.id}
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