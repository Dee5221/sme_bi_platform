import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as inventoryApi from '../services/inventoryService';
import type { InventoryItem, StockMovement } from '../services/inventoryService';
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
import './InventoryPage.css';

type AdjustMode = 'STOCK_IN' | 'STOCK_OUT' | null;

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { path?: string; message?: string }[]) {
    if (item.path && item.message) next[item.path] = item.message;
  }
  return next;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function OwnerInventoryPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('inventory.view');
  const canAdjust = hasPermission('inventory.adjust');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [movementPage, setMovementPage] = useState(1);
  const [movementPagination, setMovementPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const [adjustMode, setAdjustMode] = useState<AdjustMode>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [thresholdItem, setThresholdItem] = useState<InventoryItem | null>(null);
  const [thresholdValue, setThresholdValue] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadInventory = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view inventory.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [inventoryResult, movementResult] = await Promise.all([
        inventoryApi.listInventory({
          search: debouncedSearch || undefined,
          lowStockOnly,
          page,
          pageSize: 20,
        }),
        inventoryApi.listMovements({
          page: movementPage,
          pageSize: 10,
        }),
      ]);
      setItems(inventoryResult.items);
      setPagination(inventoryResult.pagination);
      setMovements(movementResult.items);
      setMovementPagination(movementResult.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, lowStockOnly, page, movementPage]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  function openAdjust(mode: AdjustMode, item: InventoryItem) {
    setAdjustMode(mode);
    setSelectedItem(item);
    setQuantity('');
    setReason('');
    setFormError(null);
    setFieldErrors({});
  }

  function openThreshold(item: InventoryItem) {
    setThresholdItem(item);
    setThresholdValue(String(item.lowStockThreshold));
    setFormError(null);
    setFieldErrors({});
  }

  async function onSubmitAdjust(event: FormEvent) {
    event.preventDefault();
    if (!selectedItem || !adjustMode) return;
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      setFieldErrors({ quantity: 'Enter a positive whole number.' });
      return;
    }

    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const payload = {
        productId: selectedItem.productId,
        quantity: qty,
        reason: reason || undefined,
      };
      if (adjustMode === 'STOCK_IN') {
        await inventoryApi.stockIn(payload);
        pushToast('Stock increased.', 'success');
      } else {
        await inventoryApi.stockOut(payload);
        pushToast('Stock decreased.', 'success');
      }
      setAdjustMode(null);
      setSelectedItem(null);
      setLoading(true);
      await loadInventory();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to update stock.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitThreshold(event: FormEvent) {
    event.preventDefault();
    if (!thresholdItem) return;
    const value = Number(thresholdValue);
    if (!Number.isInteger(value) || value < 0) {
      setFieldErrors({ lowStockThreshold: 'Enter a non-negative whole number.' });
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await inventoryApi.updateThreshold(thresholdItem.id, value);
      pushToast('Low-stock threshold updated.', 'success');
      setThresholdItem(null);
      await loadInventory();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to update threshold.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view inventory.</Alert>;
  }

  return (
    <div className="inventory-page">
      <PageHeader
        title="Inventory"
        subtitle="Monitor stock levels, record movements, and manage low-stock alerts."
      />

      <Card>
        <div className="inventory-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search product or SKU"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <label className="inventory-toggle">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setPage(1);
                setLowStockOnly(e.target.checked);
              }}
            />
            <span>Show low stock only</span>
          </label>
        </div>

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <>
            <DataTable
              rows={items}
              rowKey={(row) => row.id}
              emptyTitle="No inventory records"
              emptyDescription="Create products first. Each product starts with zero stock."
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  render: (row) => (
                    <div>
                      <strong>{row.product.name}</strong>
                      <div className="inventory-muted">{row.product.sku}</div>
                    </div>
                  ),
                },
                {
                  key: 'qty',
                  header: 'Quantity',
                  render: (row) => (
                    <span>
                      {row.quantity}
                      {row.product.unit ? ` ${row.product.unit}` : ''}
                    </span>
                  ),
                },
                {
                  key: 'threshold',
                  header: 'Low-stock at',
                  render: (row) => row.lowStockThreshold,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) =>
                    row.isLowStock ? (
                      <Badge tone="orange">Low stock</Badge>
                    ) : (
                      <Badge tone="green">OK</Badge>
                    ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row) =>
                    canAdjust ? (
                      <div className="inventory-actions">
                        <Button variant="ghost" onClick={() => openAdjust('STOCK_IN', row)}>
                          Stock in
                        </Button>
                        <Button variant="ghost" onClick={() => openAdjust('STOCK_OUT', row)}>
                          Stock out
                        </Button>
                        <Button variant="ghost" onClick={() => openThreshold(row)}>
                          Threshold
                        </Button>
                      </div>
                    ) : (
                      '—'
                    ),
                },
              ]}
            />

            <div className="inventory-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} items
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

      <Card title="Recent movements">
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
              render: (row) => row.product?.name || row.productId,
            },
            {
              key: 'type',
              header: 'Type',
              render: (row) => (
                <Badge tone={row.type === 'STOCK_IN' ? 'green' : 'orange'}>{row.type}</Badge>
              ),
            },
            {
              key: 'change',
              header: 'Change',
              render: (row) => (row.quantityChange > 0 ? `+${row.quantityChange}` : row.quantityChange),
            },
            {
              key: 'after',
              header: 'After',
              render: (row) => row.quantityAfter,
            },
            {
              key: 'actor',
              header: 'By',
              render: (row) => row.actor?.name || '—',
            },
          ]}
        />
        <div className="inventory-pagination">
          <span>
            Page {movementPagination.page} of {movementPagination.totalPages}
          </span>
          <div className="inventory-actions">
            <Button
              variant="secondary"
              disabled={movementPage <= 1}
              onClick={() => setMovementPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={movementPage >= movementPagination.totalPages}
              onClick={() => setMovementPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        open={Boolean(adjustMode && selectedItem)}
        title={adjustMode === 'STOCK_IN' ? 'Stock in' : 'Stock out'}
        onClose={() => {
          setAdjustMode(null);
          setSelectedItem(null);
        }}
      >
        <form className="inventory-form" onSubmit={onSubmitAdjust} noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <p className="inventory-help">
            {selectedItem?.product.name} · current stock: <strong>{selectedItem?.quantity}</strong>
          </p>
          <Input
            label="Quantity"
            name="quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={fieldErrors.quantity}
            required
          />
          <Input
            label="Reason (optional)"
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={fieldErrors.reason}
          />
          <div className="inventory-form__actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAdjustMode(null);
                setSelectedItem(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Confirm
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(thresholdItem)}
        title="Update low-stock threshold"
        onClose={() => setThresholdItem(null)}
      >
        <form className="inventory-form" onSubmit={onSubmitThreshold} noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <p className="inventory-help">
            Alert when {thresholdItem?.product.name} quantity is at or below this value.
          </p>
          <Input
            label="Low-stock threshold"
            name="lowStockThreshold"
            type="number"
            min="0"
            step="1"
            value={thresholdValue}
            onChange={(e) => setThresholdValue(e.target.value)}
            error={fieldErrors.lowStockThreshold}
            required
          />
          <div className="inventory-form__actions">
            <Button type="button" variant="secondary" onClick={() => setThresholdItem(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save threshold
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
