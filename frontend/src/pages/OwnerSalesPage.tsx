import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as salesApi from '../services/saleService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Input } from '../components/ui/Input';
import './sales.css';

interface Sale {
  id: number;
  sale_datetime: string;
  total_amount: number;
  payment_method: string;
  status: string;
  customer?: {
    id: number;
    name: string;
  } | null;
  user?: {
    id: number;
    name: string;
    email: string;
  };
  items: Array<{
    id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    subtotal: number;
    product?: {
      id: number;
      name: string;
      sku: string;
    };
  }>;
}

const ITEMS_PER_PAGE = 20;

export function OwnerSalesPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Get filter params from URL
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  const statusFilter = searchParams.get('status') || '';
  const userId = searchParams.get('user_id') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // Client-side filtering
  const filteredSales = sales.filter((sale) => {
    if (startDate) {
      const saleDate = new Date(sale.sale_datetime);
      const start = new Date(startDate);
      if (saleDate < start) return false;
    }

    if (endDate) {
      const saleDate = new Date(sale.sale_datetime);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (saleDate > end) return false;
    }

    if (statusFilter && sale.status !== statusFilter) return false;

    if (userId && sale.user?.id !== parseInt(userId, 10)) return false;

    return true;
  });

  // Client-side pagination
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE));
  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    try {
      setLoading(true);
      setError(null);
      // Backend doesn't support pagination - fetch all and paginate client-side
      const data = await salesApi.listSales({});
      const items = Array.isArray(data) ? data : (data as any)?.items || [];
      setSales(items);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filters change
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

  if (loading) {
    return (
      <div className="sales-page">
        <div className="sales-header">
          <h1 className="sales-title">Sales History</h1>
        </div>
        <Card>
          <LoadingSkeleton rows={10} />
        </Card>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1 className="sales-title">Sales History</h1>
          <p className="sales-subtitle">
            View and manage all sales transactions
          </p>
        </div>
        {hasPermission('sales.create') && (
          <Link to="/app/sales/new">
            <Button>New Sale</Button>
          </Link>
        )}
      </div>

      {error && (
        <div className="sales-alert sales-alert--error">
          {error}
        </div>
      )}

      {/* Filters */}
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
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <Input
            label="User ID"
            type="number"
            value={userId}
            onChange={(e) => handleFilterChange('user_id', e.target.value)}
            placeholder="Filter by user"
          />
        </div>
      </Card>

      {/* Sales Table */}
      <Card>
        {paginatedSales.length === 0 ? (
          <div className="sales-empty">
            <p>No sales found</p>
          </div>
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
                    <th>User</th>
                    <th className="sales-table-th--right">Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="sales-table-td--muted">
                        {new Date(sale.sale_datetime).toLocaleString('en-ZM', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="sales-table-td--bold">#{sale.id}</td>
                      <td>{sale.customer?.name || 'Walk-in Customer'}</td>
                      <td className="sales-table-td--muted">
                        {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                      </td>
                      <td>
                        <Badge tone="neutral">{sale.payment_method}</Badge>
                      </td>
                      <td>{getStatusBadge(sale.status)}</td>
                      <td className="sales-table-td--muted">
                        {sale.user?.name || '—'}
                      </td>
                      <td className="sales-table-td--right sales-table-td--bold">
                        K{sale.total_amount.toLocaleString('en-ZM', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        <Link
                          to={`/app/sales/${sale.id}`}
                          className="sales-action-link"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="sales-pagination">
                <div className="sales-pagination-info">
                  Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredSales.length)} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredSales.length)} of{' '}
                  {filteredSales.length} sales
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