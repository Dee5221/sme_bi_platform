import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  for (const item of details as { loc?: string[]; msg?: string }[]) {
    if (item.loc && item.msg) {
      const fieldName = item.loc[item.loc.length - 1];
      next[fieldName] = item.msg;
    }
  }
  return next;
}

export function StockOutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();
  const canAdjust = hasPermission('inventory.manage');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [productId, setProductId] = useState(searchParams.get('product_id') || '');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const loadInventory = useCallback(async () => {
    if (!canAdjust) {
      setLoadError('You do not have permission to record stock out.');
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
    () => items.find((item) => String(item.product_id) === productId) ?? null,
    [items, productId]
  );

  async function onSubmitStockOut(event: FormEvent) {
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
    if (selectedItem && qty > selectedItem.quantity_on_hand) {
      setFieldErrors({
        quantity: `Cannot remove more than current stock (${selectedItem.quantity_on_hand}).`,
      });
      return;
    }

    setSaving(true);
    try {
      await inventoryApi.stockOut({
        productId: Number(productId),
        quantity: qty,
        reason: reason || undefined,
      });
      pushToast('Stock decreased.', 'success');
      navigate('/app/inventory/movements');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to record stock out.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitAdjust(event: FormEvent) {
    event.preventDefault();
    if (!canAdjust) return;
    setAdjustError(null);
    setFieldErrors({});

    if (!productId) {
      setAdjustError('Select a product.');
      return;
    }

    const qty = Number(newQuantity);
    if (Number.isNaN(qty) || qty < 0) {
      setFieldErrors({ new_quantity: 'Enter a quantity of 0 or more.' });
      return;
    }

    setAdjusting(true);
    try {
      await inventoryApi.adjustStock({
        productId: Number(productId),
        newQuantity: qty,
        reason: adjustReason || undefined,
      });
      pushToast('Stock quantity corrected.', 'success');
      navigate('/app/inventory/movements');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setAdjustError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setAdjustError('Unable to correct stock quantity.');
      }
    } finally {
      setAdjusting(false);
    }
  }

  if (!canAdjust) {
    return <Alert tone="error">You do not have permission to record stock out.</Alert>;
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
        <Link className="inventory-back" to="/app/inventory/movements">
          ← Back to stock movements
        </Link>
        <Alert tone="error">{loadError}</Alert>
      </div>
    );
  }

  return (
    <div className="inventory-page">
      <Link className="inventory-back" to="/app/inventory/movements">
        ← Back to stock movements
      </Link>
      <PageHeader
        title="Stock Out / Adjustments"
        subtitle="Remove stock or correct the on-hand quantity. Each change is recorded as a movement."
      />

      <Card>
        {items.length === 0 ? (
          <EmptyState
            title="No products to adjust"
            description="Create products first. Each product starts with an inventory record at zero."
            action={
              <Link to="/app/products">
                <Button>Go to Products</Button>
              </Link>
            }
          />
        ) : (
          <form className="inventory-form" onSubmit={onSubmitStockOut} noValidate>
            {formError ? <Alert tone="error">{formError}</Alert> : null}
            <label className="inventory-select">
              <span>Product</span>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="">Select product</option>
                {items.map((item) => (
                  <option key={item.product_id} value={item.product_id}>
                    {item.product_name} ({item.sku}) · current stock {item.quantity_on_hand}
                  </option>
                ))}
              </select>
            </label>
            {selectedItem ? (
              <p className="inventory-help">
                Current stock for <strong>{selectedItem.product_name}</strong>:{' '}
                <strong>{selectedItem.quantity_on_hand}</strong>
              </p>
            ) : null}
            <Input
              label="Quantity to remove"
              name="quantity"
              type="number"
              min="1"
              step="1"
              max={selectedItem ? selectedItem.quantity_on_hand : undefined}
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
              <Button type="button" variant="secondary" onClick={() => navigate('/app/inventory/movements')}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Confirm stock out
              </Button>
            </div>
          </form>
        )}
      </Card>

      {items.length > 0 ? (
        <Card>
          <PageHeader
            title="Quantity correction"
            subtitle="Set the on-hand quantity to an exact value after a count or data error."
          />
          <form className="inventory-form" onSubmit={onSubmitAdjust} noValidate>
            {adjustError ? <Alert tone="error">{adjustError}</Alert> : null}
            <Input
              label="New quantity on hand"
              name="new_quantity"
              type="number"
              min="0"
              step="1"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              error={fieldErrors.new_quantity}
              required
            />
            <Input
              label="Reason (optional)"
              name="adjust_reason"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
            <div className="inventory-form__actions">
              <Button type="submit" loading={adjusting}>
                Save correction
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
