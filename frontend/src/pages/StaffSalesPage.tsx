import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as saleService from '../services/saleService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import './SalesPage.css';

const ITEMS_PER_PAGE = 15;

export function StaffSalesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<saleService.Sale[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        // Backend returns a flat array, not a paginated object
        const items = Array.isArray(data) ? data : [];

        // Sort by date descending
        items.sort((a, b) =>
          new Date(b.sale_datetime).getTime() - new Date(a.sale_datetime).getTime()
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
      case 'completed': return <Badge tone="green">Completed</Badge>;
      case 'pending': return <Badge tone="orange">Pending</Badge>;
      case 'cancelled': return <Badge tone="red">Cancelled</Badge>;
      case 'refunded': return <Badge tone="neutral">Refunded</Badge>;
      default: return <Badge tone="neutral">{status}</Badge>;
    }
  }

  if (loading) {
    return (
      <div className="sales-page">
        <div className="sales-header">
          <h1 className="sales-title">My Sales</h1>
        </div>
        <Card><LoadingSkeleton rows={10} /></Card>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1 className="sales-title">My Sales</h1>
          <p className="sales-subtitle">View your sales transactions</p>
        </div>
        <Link to="/app/sales/new">
          <Button>New Sale</Button>
        </Link>
      </div>

      {error && (
        <div className="sales-alert sales-alert--error">{error}</div>
      )}

      <Card className="sales-filters">
        <div className="sales-filter-grid">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => handleFilterChange('start_date', e.target.value)}
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => handleFilterChange('end_date', e.target.value)}
          />
          <div className="sales-filter-field">
            <label className="sales-filter-label">Status</label>
            <select
              className="sales-filter-select"
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
      </Card>

      <Card>
        {paginatedSales.length === 0 ? (
          <div className="sales-empty">No sales found for the selected criteria.</div>
        ) : (
          <>
            <div className="sales-table-wrapper">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Sale ID</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th className="sales-table-th--right">Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="sales-table-td--muted">
                        {new Date(sale.sale_datetime).toLocaleString('en-ZM', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="sales-table-td--bold">#{sale.id}</td>
                      <td>{sale.customer?.name || 'Walk-in'}</td>
                      <td className="sales-table-td--muted">
                        {sale.items?.length || 0} item{sale.items?.length !== 1 ? 's' : ''}
                      </td>
                      <td><Badge tone="neutral">{sale.payment_method}</Badge></td>
                      <td>{getStatusBadge(sale.status)}</td>
                      <td className="sales-table-td--right sales-table-td--bold">
                        K{Number(sale.total_amount).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td>
                        <Link to={`/app/sales/${sale.id}`} className="sales-action-link">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="sales-pagination">
                <div className="sales-pagination-info">
                  Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredSales.length)} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredSales.length)} of {filteredSales.length} sales
                </div>
                <div className="sales-pagination-controls">
                  <Button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="sales-pagination-page">
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
    </div>
  );
}