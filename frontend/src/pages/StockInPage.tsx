import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as inventoryApi from '../services/inventoryService';
import type { InventoryItem } from '../services/inventoryService';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
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

export function StockInPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();
  const canAdjust = hasPermission('inventory.adjust');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadInventory = useCallback(async () => {
    if (!canAdjust) {
      setLoadError('You do not have permission to record stock in.');
      setLoading(false);
      return;
    }
    try {
      const result = await inventoryApi.listInventory({ pageSize: 100 });
      setItems(result.items);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiClientError ? err.message : 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }, [canAdjust]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const selectedItem = useMemo(
    () => items.find((item) => item.productId === productId) ?? null,
    [items, productId]
  );

  async function onSubmitStockIn(event: FormEvent) {
    event.preventDefault();
    if (!canAdjust) return;
    setFormError(null);
    setFieldErrors({});

    if (!productId) {
      setFormError('Select a product.');
      return;
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      setFieldErrors({ quantity: 'Enter a positive whole number.' });
      return;
    }

    setSaving(true);
    try {
      await inventoryApi.stockIn({
        productId,
        quantity: qty,
        reason: reason || undefined,
      });
      pushToast('Stock increased.', 'success');
      navigate('/app/inventory');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to record stock in.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!canAdjust) {
    return <Alert tone="error">You do not have permission to record stock in.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={6} />
      </Card>
    );
  }

  if (loadError) {
    return (
      <div className="inventory-page">
        <Link className="inventory-back" to="/app/inventory">
          ← Back to inventory
        </Link>
        <Alert tone="error">{loadError}</Alert>
      </div>
    );
  }

  return (
    <div className="inventory-page">
      <Link className="inventory-back" to="/app/inventory">
        ← Back to inventory
      </Link>
      <PageHeader
        title="Stock in"
        subtitle="Increase on-hand quantity for a product. The movement is recorded immediately."
      />

      <Card>
        {items.length === 0 ? (
          <EmptyState
            title="No products to stock"
            description="Create products first. Each product starts with an inventory record at zero."
            action={
              <Link to="/app/products">
                <Button>Go to Products</Button>
              </Link>
            }
          />
        ) : (
          <form className="inventory-form" onSubmit={onSubmitStockIn} noValidate>
            {formError ? <Alert tone="error">{formError}</Alert> : null}
            <label className="inventory-select">
              <span>Product</span>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="">Select product</option>
                {items.map((item) => (
                  <option key={item.id} value={item.productId}>
                    {item.product.name} ({item.product.sku}) · current stock {item.quantity}
                    {item.product.unit ? ` ${item.product.unit}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {selectedItem ? (
              <p className="inventory-help">
                Current stock for <strong>{selectedItem.product.name}</strong>:{' '}
                <strong>
                  {selectedItem.quantity}
                  {selectedItem.product.unit ? ` ${selectedItem.product.unit}` : ''}
                </strong>
              </p>
            ) : null}
            <Input
              label="Quantity to add"
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
            <div className="inventory-form__actions inventory-form__actions--split">
              <Button type="button" variant="secondary" onClick={() => navigate('/app/inventory')}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Confirm stock in
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
