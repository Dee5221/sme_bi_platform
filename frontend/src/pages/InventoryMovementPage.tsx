import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as inventoryApi from '../services/inventoryService';
import type { InventoryItem, StockMovement } from '../services/inventoryService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import './InventoryPage.css';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatType(type: string) {
  return type === 'STOCK_IN' ? 'Stock in' : type === 'STOCK_OUT' ? 'Stock out' : type;
}

export function InventoryMovementPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('inventory.view');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);

  const loadMovements = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view inventory movements.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [inventoryResult, movementResult] = await Promise.all([
        inventoryApi.listInventory({ pageSize: 100 }),
        inventoryApi.listMovements({
          productId: productId || undefined,
          type: type === 'ALL' ? undefined : type,
          page,
          pageSize: 20,
        }),
      ]);
      setProducts(inventoryResult.items);
      setMovements(movementResult.items);
      setPagination(movementResult.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load inventory movements.');
    } finally {
      setLoading(false);
    }
  }, [canView, productId, type, page]);

  useEffect(() => {
    void loadMovements();
  }, [loadMovements]);

  function clearFilters() {
    setProductId('');
    setType('ALL');
    setPage(1);
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view inventory movements.</Alert>;
  }

  return (
    <div className="inventory-page">
      <Link className="inventory-back" to="/app/inventory">
        ← Back to inventory
      </Link>
      <PageHeader
        title="Inventory movement"
        subtitle="Review stock in and stock out activity for this business."
      />

      <Card>
        <div className="inventory-movements-toolbar">
          <label className="inventory-select">
            <span>Product</span>
            <select
              value={productId}
              onChange={(e) => {
                setPage(1);
                setProductId(e.target.value);
              }}
            >
              <option value="">All products</option>
              {products.map((item) => (
                <option key={item.id} value={item.productId}>
                  {item.product.name} ({item.product.sku})
                </option>
              ))}
            </select>
          </label>
          <label className="inventory-select">
            <span>Type</span>
            <select
              value={type}
              onChange={(e) => {
                setPage(1);
                setType(e.target.value);
              }}
            >
              <option value="ALL">All types</option>
              <option value="STOCK_IN">Stock in</option>
              <option value="STOCK_OUT">Stock out</option>
            </select>
          </label>
          <Button type="button" variant="secondary" onClick={clearFilters}>
            Clear
          </Button>
        </div>

        {loading ? (
          <LoadingSkeleton rows={8} />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <>
            <DataTable
              rows={movements}
              rowKey={(row) => row.id}
              emptyTitle="No stock movements yet"
              emptyDescription="Stock in and stock out actions will appear here."
              columns={[
                {
                  key: 'when',
                  header: 'When',
                  render: (row) => formatDate(row.createdAt),
                },
                {
                  key: 'product',
                  header: 'Product',
                  render: (row) => (
                    <div>
                      <strong>{row.product?.name || row.productId}</strong>
                      {row.product?.sku ? (
                        <div className="inventory-muted">{row.product.sku}</div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: 'type',
                  header: 'Type',
                  render: (row) => (
                    <Badge tone={row.type === 'STOCK_IN' ? 'green' : 'orange'}>
                      {formatType(row.type)}
                    </Badge>
                  ),
                },
                {
                  key: 'change',
                  header: 'Change',
                  render: (row) =>
                    row.quantityChange > 0 ? `+${row.quantityChange}` : row.quantityChange,
                },
                {
                  key: 'after',
                  header: 'Balance after',
                  render: (row) => row.quantityAfter,
                },
                {
                  key: 'actor',
                  header: 'Recorded by',
                  render: (row) => row.actor?.name || '—',
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row) => (
                    <Button variant="ghost" onClick={() => setSelectedMovement(row)}>
                      View
                    </Button>
                  ),
                },
              ]}
            />

            <div className="inventory-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} movements
              </span>
              <div className="inventory-actions">
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
        open={Boolean(selectedMovement)}
        title={selectedMovement ? formatType(selectedMovement.type) : 'Movement'}
        onClose={() => setSelectedMovement(null)}
        width="lg"
      >
        {selectedMovement ? (
          <div className="inventory-detail">
            <p>
              <strong>Product:</strong>{' '}
              {selectedMovement.product
                ? `${selectedMovement.product.name} (${selectedMovement.product.sku})`
                : selectedMovement.productId}
            </p>
            <p>
              <strong>When:</strong> {formatDate(selectedMovement.createdAt)}
            </p>
            <p>
              <strong>Recorded by:</strong> {selectedMovement.actor?.name || '—'}
            </p>
            <p>
              <strong>Change:</strong>{' '}
              {selectedMovement.quantityChange > 0
                ? `+${selectedMovement.quantityChange}`
                : selectedMovement.quantityChange}
            </p>
            <p>
              <strong>Before:</strong> {selectedMovement.quantityBefore}
            </p>
            <p>
              <strong>After:</strong> {selectedMovement.quantityAfter}
            </p>
            {selectedMovement.reason ? (
              <p>
                <strong>Reason:</strong> {selectedMovement.reason}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
