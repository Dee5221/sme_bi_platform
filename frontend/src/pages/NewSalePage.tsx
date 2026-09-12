import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as customerApi from '../services/customerService';
import type { Customer } from '../services/customerService';
import * as productApi from '../services/productService';
import type { Product } from '../services/productService';
import * as saleApi from '../services/saleService';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import './SalesPage.css';

type LineDraft = {
  key: string;
  productId: string;
  quantity: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { path?: string; message?: string }[]) {
    if (item.path && item.message) next[item.path] = item.message;
  }
  return next;
}

function emptyLines(): LineDraft[] {
  return [{ key: crypto.randomUUID(), productId: '', quantity: '1' }];
}

export function NewSalePage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();
  const canCreate = hasPermission('sales.create');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(emptyLines);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (!canCreate) {
      setLoadError('You do not have permission to record a sale.');
      setLoading(false);
      return;
    }
    try {
      const [productsResult, customersResult] = await Promise.all([
        productApi.listProducts({ status: 'ACTIVE', pageSize: 100 }),
        customerApi.listCustomers({ status: 'ACTIVE', pageSize: 100 }),
      ]);
      setProducts(productsResult.items);
      setCustomers(customersResult.items);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiClientError ? err.message : 'Unable to load sale catalog.');
    } finally {
      setLoading(false);
    }
  }, [canCreate]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const draftTotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const product = productMap.get(line.productId);
      const qty = Number(line.quantity);
      if (!product || !Number.isFinite(qty) || qty <= 0) return sum;
      return sum + product.price * qty;
    }, 0);
  }, [lines, productMap]);

  function addLine() {
    setLines((current) => [
      ...current,
      { key: crypto.randomUUID(), productId: '', quantity: '1' },
    ]);
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }

  function removeLine(key: string) {
    setLines((current) =>
      current.length <= 1 ? current : current.filter((line) => line.key !== key)
    );
  }

  async function onCreateSale(event: FormEvent) {
    event.preventDefault();
    if (!canCreate) return;
    setFormError(null);
    setFieldErrors({});

    const items = lines
      .filter((line) => line.productId)
      .map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
      }));

    if (items.length === 0) {
      setFormError('Add at least one product line.');
      return;
    }
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      setFormError('Quantities must be positive whole numbers.');
      return;
    }

    setSaving(true);
    try {
      await saleApi.createSale({
        customerId: customerId || undefined,
        notes: notes || undefined,
        items,
      });
      pushToast('Sale recorded.', 'success');
      navigate('/app/sales');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to record sale.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!canCreate) {
    return <Alert tone="error">You do not have permission to record a sale.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={8} />
      </Card>
    );
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <Link className="sales-back" to="/app/sales">
          ← Back to sales
        </Link>
        <Alert tone="error">{loadError}</Alert>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <Link className="sales-back" to="/app/sales">
        ← Back to sales
      </Link>
      <PageHeader
        title="New sale"
        subtitle="Record a transaction. Prices are frozen at the time of sale and stock is deducted immediately."
      />

      <Card>
        {products.length === 0 ? (
          <EmptyState
            title="No products available"
            description="Add an active product with stock before recording a sale."
            action={
              <Link to="/app/products">
                <Button>Go to Products</Button>
              </Link>
            }
          />
        ) : (
          <form className="sales-form" onSubmit={onCreateSale} noValidate>
            {formError ? <Alert tone="error">{formError}</Alert> : null}
            <div className="sales-form__meta">
              <label className="sales-select">
                <span>Customer (optional)</span>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Walk-in / no customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Notes"
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                error={fieldErrors.notes}
              />
            </div>

            <div className="sales-lines">
              {lines.map((line) => {
                const product = productMap.get(line.productId);
                return (
                  <div className="sales-line" key={line.key}>
                    <label className="sales-select">
                      <span>Product</span>
                      <select
                        value={line.productId}
                        onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                      >
                        <option value="">Select product</option>
                        {products.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.sku}) · stock {item.inventory?.quantity ?? 0}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input
                      label="Qty"
                      name={`qty-${line.key}`}
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                    <div className="sales-line__meta">
                      <span>{product ? formatMoney(product.price) : '—'}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length <= 1}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sales-form__footer">
              <Button type="button" variant="secondary" onClick={addLine}>
                Add line
              </Button>
              <div className="sales-total">
                Estimated total: <strong>{formatMoney(draftTotal)}</strong>
              </div>
              <div className="sales-actions">
                <Button type="button" variant="secondary" onClick={() => navigate('/app/sales')}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  Record sale
                </Button>
              </div>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
