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
  productId: number | '';
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
  for (const item of details as { loc?: string[]; msg?: string }[]) {
    if (item.loc && item.msg) {
      const fieldName = item.loc[item.loc.length - 1];
      next[fieldName] = item.msg;
    }
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
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
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
        productApi.listProducts({ status: 'active', pageSize: 100 }),
        customerApi.listCustomers({ page: 1, pageSize: 100 }), // Adjusted to match F07/F06 service
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
      const product = typeof line.productId === 'number' ? productMap.get(line.productId) : undefined;
      const qty = Number(line.quantity);
      if (!product || !Number.isFinite(qty) || qty <= 0) return sum;
      return sum + product.selling_price * qty;
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
      .filter((line): line is { key: string; productId: number; quantity: string } => typeof line.productId === 'number' && line.productId !== '')
      .map((line) => ({
        product_id: line.productId,
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
        customer_id: typeof customerId === 'number' ? customerId : undefined,
        payment_method: paymentMethod,
        items,
      });
      pushToast('Sale recorded successfully.', 'success');
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
        subtitle="Record a transaction. Prices and totals are calculated securely by the system."
      />

      <Card>
        {products.length === 0 ? (
          <EmptyState
            title="No products available"
            description="Add an active product before recording a sale."
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
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Walk-in / no customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sales-select">
                <span>Payment Method</span>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </label>
            </div>

            <div className="sales-lines">
              {lines.map((line) => {
                const product = typeof line.productId === 'number' ? productMap.get(line.productId) : undefined;
                return (
                  <div className="sales-line" key={line.key}>
                    <label className="sales-select">
                      <span>Product</span>
                      <select
                        value={line.productId}
                        onChange={(e) => updateLine(line.key, { productId: e.target.value ? Number(e.target.value) : '' })}
                      >
                        <option value="">Select product</option>
                        {products.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.sku})
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
                      <span>{product ? formatMoney(product.selling_price) : '—'}</span>
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
                <Button type="submit" loading={saving} disabled={saving}>
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