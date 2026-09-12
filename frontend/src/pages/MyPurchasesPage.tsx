import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCustomerCurrency } from '../hooks/useCustomerCurrency';
import { ApiClientError } from '../lib/api';
import { formatMoney as formatMoneyValue } from '../lib/money';
import * as purchaseApi from '../services/customerPortalPurchaseService';
import type { CustomerPurchase } from '../services/customerPortalPurchaseService';
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

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function MyPurchasesPage() {
  const { hasPermission } = useAuth();
  const { preferredCurrency, usdToZmwRate } = useCustomerCurrency();
  const formatMoney = (value: number) =>
    formatMoneyValue(value, { currency: preferredCurrency, usdToZmwRate });
  const canView = hasPermission('portal.purchases.view');
  const canViewHistory = hasPermission('portal.purchases.history');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<CustomerPurchase[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedPurchase, setSelectedPurchase] = useState<CustomerPurchase | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadPurchases = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view purchases.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await purchaseApi.listCustomerPurchases({
        search: debouncedSearch || undefined,
        page,
        pageSize: 20,
      });
      setPurchases(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load purchases.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, page]);

  useEffect(() => {
    void loadPurchases();
  }, [loadPurchases]);

  if (!canView) {
    return <Alert tone="error">You do not have permission to view purchases.</Alert>;
  }

  return (
    <div className="sales-page">
      <PageHeader
        title="My purchases"
        subtitle="Review completed orders linked to your customer account."
        actions={
          canViewHistory ? (
            <Link className="ui-btn ui-btn--secondary" to="/app/portal/purchases/history">
              Purchase history
            </Link>
          ) : null
        }
      />

      <Card>
        <div className="sales-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search sale number, notes, or product"
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
              rows={purchases}
              rowKey={(row) => row.id}
              emptyTitle="No purchases yet"
              emptyDescription="When this business records a sale for your account, it will appear here."
              columns={[
                {
                  key: 'number',
                  header: 'Purchase',
                  render: (row) => (
                    <div>
                      <strong>{row.saleNumber}</strong>
                      <div className="sales-muted">{formatDate(row.soldAt)}</div>
                    </div>
                  ),
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
                    <Button variant="ghost" onClick={() => setSelectedPurchase(row)}>
                      View
                    </Button>
                  ),
                },
              ]}
            />

            <div className="sales-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} purchases
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
        open={Boolean(selectedPurchase)}
        title={selectedPurchase ? selectedPurchase.saleNumber : 'Purchase'}
        onClose={() => setSelectedPurchase(null)}
        width="lg"
      >
        {selectedPurchase ? (
          <div className="sales-detail">
            <p>
              <strong>Purchased:</strong> {formatDate(selectedPurchase.soldAt)}
            </p>
            {selectedPurchase.notes ? (
              <p>
                <strong>Notes:</strong> {selectedPurchase.notes}
              </p>
            ) : null}
            <DataTable
              rows={selectedPurchase.items}
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
              Total: <strong>{formatMoney(selectedPurchase.total)}</strong>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
