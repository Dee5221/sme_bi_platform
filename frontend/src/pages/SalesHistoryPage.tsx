import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as saleService from '../services/saleService';
import type { SaleDetail, SaleListItem } from '../services/saleService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Input } from '../components/ui/Input';
import { DialogLayer } from '../components/ui/DialogLayer';
import './SalesPage.css';

const ITEMS_PER_PAGE = 15;

export function SalesHistoryPage() {
  const { hasPermission } = useAuth();
  const canViewAll = hasPermission('sales.view_all');
  const canViewCosts = hasPermission('products.costs.view');
  const pageTitle = canViewAll ? 'Sales History' : 'My Sales History';
  const pageSubtitle = canViewAll
    ? 'Review itemised transactions for this business.'
    : 'Review sales you recorded, including line items.';
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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
        items.sort(
          (a, b) =>
            new Date(b.sale_datetime).getTime() -
            new Date(a.sale_datetime).getTime()
        );
        setSales(items);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load sales history');
      } finally {
        setLoading(false);
      }
    }
    loadSales();
  }, [startDate, endDate, statusFilter]);

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sales;
    return sales.filter((sale) => {
      const haystack = [
        String(sale.id),
        sale.customer_name || '',
        sale.user_name || '',
        sale.payment_method || '',
        sale.status || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [sales, search]);

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

  async function openSale(saleId: number) {
    setDetailError(null);
    setDetailLoading(true);
    setSelectedSale(null);
    try {
      const detail = await saleService.getSale(saleId);
      setSelectedSale(detail);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load sale details.');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedSale(null);
    setDetailError(null);
    setDetailLoading(false);
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
            <h1 className="page-title">{pageTitle}</h1>
            <p className="page-subtitle">{pageSubtitle}</p>
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
          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-subtitle">
            {pageSubtitle}
            {filteredSales.length > 0 && (
              <span>
                {filteredSales.length === 1
                  ? ' 1 sale total.'
                  : ` ${filteredSales.length} sales total.`}
              </span>
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
          <Input
            label="Search"
            name="q"
            placeholder="Sale ID, customer, or cashier"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              handleFilterChange('q', event.target.value);
            }}
          />
        </div>
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
                : 'No sales match the current filters. Try adjusting your search, date range, or status.'}
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
                    {canViewAll ? <th>Cashier</th> : null}
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
                      <td>{sale.customer_name || 'Walk-in'}</td>
                      {canViewAll ? <td>{sale.user_name || '—'}</td> : null}
                      <td className="data-table__muted">
                        {sale.item_count || 0} item{sale.item_count !== 1 ? 's' : ''}
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
                          onClick={() => void openSale(sale.id)}
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

      <DialogLayer
        open={Boolean(detailLoading || detailError || selectedSale)}
        onClose={closeDetail}
        className="sale-modal-overlay"
      >
          <div
            className="sale-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sale-modal-title"
            tabIndex={-1}
          >
            <div className="sale-modal__header">
              <div>
                <h2 id="sale-modal-title" className="sale-modal__title">
                  {selectedSale ? `Sale #${selectedSale.id}` : 'Sale details'}
                </h2>
                {selectedSale ? (
                  <p className="sale-modal__subtitle">
                    {new Date(selectedSale.sale_datetime).toLocaleString('en-ZM', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="sale-modal__close"
                onClick={closeDetail}
                aria-label="Close sale details"
              >
                ✕
              </button>
            </div>

            <div className="sale-modal__body">
              {detailLoading ? <LoadingSkeleton rows={6} /> : null}
              {detailError ? (
                <div className="error-state" role="alert">
                  <h3 className="error-state__title">Unable to load this sale</h3>
                  <p className="error-state__description">{detailError}</p>
                </div>
              ) : null}
              {selectedSale ? (
                <>
                  <div className="sale-modal__info-grid">
                    <div className="sale-modal__info-item">
                      <span className="sale-modal__info-label">Status</span>
                      {getStatusBadge(selectedSale.status)}
                    </div>
                    <div className="sale-modal__info-item">
                      <span className="sale-modal__info-label">Customer</span>
                      <span>{selectedSale.customer_name || 'Walk-in Customer'}</span>
                    </div>
                    <div className="sale-modal__info-item">
                      <span className="sale-modal__info-label">Payment</span>
                      <span>{selectedSale.payment_method}</span>
                    </div>
                    <div className="sale-modal__info-item">
                      <span className="sale-modal__info-label">Recorded By</span>
                      <span>{selectedSale.user_name || '—'}</span>
                    </div>
                  </div>

                  <h3 className="sale-modal__section-title">Items</h3>
                  {selectedSale.items.length === 0 ? (
                    <p className="sale-modal__subtitle">
                      No line items were stored for this sale.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>SKU</th>
                            <th className="data-table__right">Unit Price</th>
                            <th className="data-table__right">Qty</th>
                            {canViewCosts ? (
                              <th className="data-table__right">Unit Cost</th>
                            ) : null}
                            <th className="data-table__right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSale.items.map((item) => (
                            <tr key={item.id}>
                              <td>{item.product_name || `Product #${item.product_id}`}</td>
                              <td className="data-table__muted">{item.sku || '—'}</td>
                              <td className="data-table__right data-table__numeric">
                                {formatCurrency(item.unit_price)}
                              </td>
                              <td className="data-table__right data-table__numeric">
                                {item.quantity}
                              </td>
                              {canViewCosts ? (
                                <td className="data-table__right data-table__numeric">
                                  {item.unit_cost == null
                                    ? 'Unavailable'
                                    : formatCurrency(Number(item.unit_cost))}
                                </td>
                              ) : null}
                              <td className="data-table__right data-table__numeric data-table__bold">
                                {formatCurrency(item.subtotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td
                              colSpan={canViewCosts ? 5 : 4}
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
                  )}
                </>
              ) : null}
            </div>

            <div className="sale-modal__footer">
              <Button onClick={closeDetail}>Close</Button>
            </div>
          </div>
      </DialogLayer>
    </div>
  );
}
