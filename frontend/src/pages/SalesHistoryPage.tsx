import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as saleService from '../services/saleService';
import type { Sale } from '../services/saleService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import './SalesPage.css';

const ITEMS_PER_PAGE = 15;

export function SalesHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  const statusFilter = searchParams.get('status_filter') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    async function loadSales() {
      try {
        setLoading(true);
        setError(null);
        const params: saleService.ListSalesParams = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        if (statusFilter) params.status_filter = statusFilter;

        const data = await saleService.listSales(params);
        const items = Array.isArray(data) ? data : [];

        // Sort by date descending (most recent first)
        items.sort(
          (a, b) =>
            new Date(b.sale_datetime).getTime() -
            new Date(a.sale_datetime).getTime()
        );
        setSales(items);
      } catch (err: any) {
        setError(err.message || 'Failed to load sales history');
      } finally {
        setLoading(false);
      }
    }
    loadSales();
  }, [startDate, endDate, statusFilter]);

  const filteredSales = useMemo(() => sales, [sales]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE));
  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function handleFilterChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    setSearchParams(params);
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    setSearchParams(params);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed':
        return <Badge tone="green">Completed</Badge>;
      case 'pending':
        return <Badge tone="orange">Pending</Badge>;
      case 'cancelled':
        return <Badge tone="red">Cancelled</Badge>;
      case 'refunded':
        return <Badge tone="neutral">Refunded</Badge>;
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  }

  function formatCurrency(amount: number) {
    return `K${Number(amount || 0).toLocaleString('en-ZM', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (loading) {
    return (
      <div className="sales-page">
        <div className="page-header">
          <div className="page-header__content">
            <h1 className="page-title">Sales History</h1>
            <p className="page-subtitle">Review all completed transactions.</p>
          </div>
          <div className="page-header__actions">
            <Link to="/app/sales/new">
              <Button>New Sale</Button>
            </Link>
          </div>
        </div>
        <Card>
          <LoadingSkeleton rows={10} />
        </Card>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="page-header">
        <div className="page-header__content">
          <h1 className="page-title">Sales History</h1>
          <p className="page-subtitle">
            Review all completed transactions.
            {filteredSales.length > 0 && (
              <span> {filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''} total.</span>
            )}
          </p>
        </div>
        <div className="page-header__actions">
          <Link to="/app/sales/new">
            <Button>New Sale</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="error-state" role="alert">
          <h3 className="error-state__title">Unable to load sales</h3>
          <p className="error-state__description">{error}</p>
        </div>
      )}

      <div className="filter-bar">
        <div className="filter-bar__field">
          <label className="filter-bar__label" htmlFor="filter-start">
            Start Date
          </label>
          <input
            id="filter-start"
            type="date"
            className="filter-bar__input"
            value={startDate}
            onChange={(e) => handleFilterChange('start_date', e.target.value)}
          />
        </div>
        <div className="filter-bar__field">
          <label className="filter-bar__label" htmlFor="filter-end">
            End Date
          </label>
          <input
            id="filter-end"
            type="date"
            className="filter-bar__input"
            value={endDate}
            onChange={(e) => handleFilterChange('end_date', e.target.value)}
          />
        </div>
        <div className="filter-bar__field">
          <label className="filter-bar__label" htmlFor="filter-status">
            Status
          </label>
          <select
            id="filter-status"
            className="filter-bar__select"
            value={statusFilter}
            onChange={(e) => handleFilterChange('status_filter', e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <Card>
        {paginatedSales.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state__title">No sales found</h3>
            <p className="empty-state__description">
              {sales.length === 0
                ? 'Sales transactions will appear here once your first sale has been completed.'
                : 'No sales match the current filters. Try adjusting your date range or status.'}
            </p>
            <div className="empty-state__action">
              <Link to="/app/sales/new">
                <Button>Create New Sale</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Sale ID</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th className="data-table__right">Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="data-table__muted">
                        {new Date(sale.sale_datetime).toLocaleString('en-ZM', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="data-table__bold">#{sale.id}</td>
                      <td>{sale.customer?.name || 'Walk-in'}</td>
                      <td className="data-table__muted">
                        {sale.items?.length || 0} item
                        {sale.items?.length !== 1 ? 's' : ''}
                      </td>
                      <td>
                        <Badge tone="neutral">{sale.payment_method}</Badge>
                      </td>
                      <td>{getStatusBadge(sale.status)}</td>
                      <td className="data-table__right data-table__bold data-table__numeric">
                        {formatCurrency(sale.total_amount)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="sales-action-link"
                          onClick={() => setSelectedSale(sale)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <div className="pagination__info">
                  Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredSales.length)} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredSales.length)} of{' '}
                  {filteredSales.length} sales
                </div>
                <div className="pagination__controls">
                  <Button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="pagination__page">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div
          className="sale-modal-overlay"
          onClick={() => setSelectedSale(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sale-modal-title"
        >
          <div
            className="sale-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sale-modal__header">
              <div>
                <h2 id="sale-modal-title" className="sale-modal__title">
                  Sale #{selectedSale.id}
                </h2>
                <p className="sale-modal__subtitle">
                  {new Date(selectedSale.sale_datetime).toLocaleString('en-ZM', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                type="button"
                className="sale-modal__close"
                onClick={() => setSelectedSale(null)}
                aria-label="Close sale details"
              >
                ✕
              </button>
            </div>

            <div className="sale-modal__body">
              <div className="sale-modal__info-grid">
                <div className="sale-modal__info-item">
                  <span className="sale-modal__info-label">Status</span>
                  {getStatusBadge(selectedSale.status)}
                </div>
                <div className="sale-modal__info-item">
                  <span className="sale-modal__info-label">Customer</span>
                  <span>{selectedSale.customer?.name || 'Walk-in Customer'}</span>
                </div>
                <div className="sale-modal__info-item">
                  <span className="sale-modal__info-label">Payment</span>
                  <span>{selectedSale.payment_method}</span>
                </div>
                <div className="sale-modal__info-item">
                  <span className="sale-modal__info-label">Recorded By</span>
                  <span>{selectedSale.user?.name || selectedSale.user?.email || '—'}</span>
                </div>
              </div>

              <h3 className="sale-modal__section-title">Items</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="data-table__right">Unit Price</th>
                      <th className="data-table__right">Qty</th>
                      <th className="data-table__right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedSale.items || []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.product?.name || `Product #${item.product_id}`}</td>
                        <td className="data-table__right data-table__numeric">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="data-table__right data-table__numeric">
                          {item.quantity}
                        </td>
                        <td className="data-table__right data-table__numeric data-table__bold">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td
                        colSpan={3}
                        className="data-table__right"
                        style={{ fontWeight: 700, fontSize: '15px' }}
                      >
                        Total:
                      </td>
                      <td
                        className="data-table__right data-table__numeric"
                        style={{ fontWeight: 700, fontSize: '15px' }}
                      >
                        {formatCurrency(selectedSale.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="sale-modal__footer">
              <Button onClick={() => setSelectedSale(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}