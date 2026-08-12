import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as inventoryApi from '../services/inventoryService';
import type { InventoryItem } from '../services/inventoryService';
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

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { path?: string; message?: string }[]) {
    if (item.path && item.message) next[item.path] = item.message;
  }
  return next;
}

export function StaffInventoryPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('inventory.view');
  const canAdjust = hasPermission('inventory.adjust');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
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

  const [thresholdItem, setThresholdItem] = useState<InventoryItem | null>(null);
  const [thresholdValue, setThresholdValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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
      const inventoryResult = await inventoryApi.listInventory({
        search: debouncedSearch || undefined,
        lowStockOnly,
        page,
        pageSize: 20,
      });
      setItems(inventoryResult.items);
      setPagination(inventoryResult.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, lowStockOnly, page]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  function openThreshold(item: InventoryItem) {
    setThresholdItem(item);
    setThresholdValue(String(item.lowStockThreshold));
    setFormError(null);
    setFieldErrors({});
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
        subtitle="Monitor current stock levels and low-stock alerts for this business."
        actions={
          <>
            <Link className="ui-btn ui-btn--secondary" to="/app/inventory/movements">
              Movements
            </Link>
            {canAdjust ? (
              <>
                <Link className="ui-btn ui-btn--secondary" to="/app/inventory/stock-out">
                  Stock out
                </Link>
                <Link className="ui-btn ui-btn--primary" to="/app/inventory/stock-in">
                  Stock in
                </Link>
              </>
            ) : null}
          </>
        }
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
                      <Button variant="ghost" onClick={() => openThreshold(row)}>
                        Threshold
                      </Button>
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
