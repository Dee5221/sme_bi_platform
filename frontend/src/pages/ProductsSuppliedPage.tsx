import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as productApi from '../services/supplierPortalProductService';
import type {
  SuppliedProductDetail,
  SuppliedProductSummary,
} from '../services/supplierPortalProductService';
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

export function ProductsSuppliedPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('portal.products.view');
  const canViewRecords = hasPermission('portal.records.view');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<SuppliedProductSummary[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedProduct, setSelectedProduct] = useState<SuppliedProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadProducts = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view supplied products.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await productApi.listSuppliedProducts({
        search: debouncedSearch || undefined,
        page,
        pageSize: 20,
      });
      setProducts(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load supplied products.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, page]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  async function openProductDetail(productId: string) {
    setDetailLoading(true);
    setDetailError(null);
    setSelectedProduct(null);
    try {
      const result = await productApi.getSuppliedProduct(productId);
      setSelectedProduct(result.product);
    } catch (err) {
      setDetailError(
        err instanceof ApiClientError ? err.message : 'Unable to load product supply details.'
      );
    } finally {
      setDetailLoading(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view supplied products.</Alert>;
  }

  return (
    <div className="sales-page">
      <PageHeader
        title="Products supplied"
        subtitle="Products delivered to this business through your linked supplier account."
        actions={
          canViewRecords ? (
            <Link className="ui-btn ui-btn--secondary" to="/app/portal/records">
              Purchase records
            </Link>
          ) : null
        }
      />

      <Card>
        <div className="sales-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search product name or SKU"
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
              rows={products}
              rowKey={(row) => row.productId}
              emptyTitle="No supplied products yet"
              emptyDescription="When this business records stock-in linked to your supplier account, products will appear here."
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  render: (row) => (
                    <div>
                      <strong>{row.name}</strong>
                      <div className="sales-muted">{row.sku}</div>
                    </div>
                  ),
                },
                {
                  key: 'units',
                  header: 'Units supplied',
                  render: (row) => row.totalUnitsSupplied,
                },
                {
                  key: 'records',
                  header: 'Deliveries',
                  render: (row) => row.supplyRecordCount,
                },
                {
                  key: 'last',
                  header: 'Last supplied',
                  render: (row) => formatDate(row.lastSuppliedAt),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row) => (
                    <Button variant="ghost" onClick={() => void openProductDetail(row.productId)}>
                      View
                    </Button>
                  ),
                },
              ]}
            />

            <div className="sales-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} products
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
        open={detailLoading || Boolean(selectedProduct) || Boolean(detailError)}
        title={selectedProduct ? selectedProduct.product.name : 'Product supply details'}
        onClose={() => {
          setSelectedProduct(null);
          setDetailError(null);
        }}
        width="lg"
      >
        {detailLoading ? (
          <LoadingSkeleton rows={4} />
        ) : detailError ? (
          <Alert tone="error">{detailError}</Alert>
        ) : selectedProduct ? (
          <div className="sales-detail">
            <p>
              <strong>SKU:</strong> {selectedProduct.product.sku}
            </p>
            <p>
              <strong>Total units supplied:</strong> {selectedProduct.totalUnitsSupplied}
            </p>
            <p>
              <strong>Delivery records:</strong> {selectedProduct.supplyRecordCount}
            </p>
            <DataTable
              rows={selectedProduct.supplyRecords}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: 'quantity',
                  header: 'Units',
                  render: (row) => row.quantity,
                },
                {
                  key: 'reason',
                  header: 'Reason',
                  render: (row) => row.reason || '—',
                },
                {
                  key: 'createdAt',
                  header: 'Recorded',
                  render: (row) => formatDate(row.createdAt),
                },
              ]}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
