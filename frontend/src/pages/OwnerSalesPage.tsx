import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as customerApi from '../services/customerService';
import type { Customer } from '../services/customerService';
import * as productApi from '../services/productService';
import type { Product } from '../services/productService';
import * as saleApi from '../services/saleService';
import type { Sale, SaleList } from '../services/saleService';
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
import './SalesPage.css';

type LineDraft = {
  key: string;
  product_id: string;
  quantity: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
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

export function OwnerSalesPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('sales.view');
  const canCreate = hasPermission('sales.create');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [lines, setLines] = useState<LineDraft[]>([
    { key: crypto.randomUUID(), product_id: '', quantity: '1' },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadPage = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view sales.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [salesResult, productsResult, customersResult] = await Promise.all([
        saleApi.listSales({
          page,
          pageSize: 20,
        }),
        productApi.listProducts({ status: 'active', pageSize: 100 }),
        customerApi.listCustomers({ page: 1, pageSize: 100 }),
      ]);
      setSales(salesResult.items);
      setPagination(salesResult.pagination);
      setProducts(productsResult.items);
      setCustomers(customersResult.items);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load sales.');
    } finally {
      setLoading(false);
    }
  }, [canView, page]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const productMap = useMemo(
    () => new Map(products.map((product) => [String(product.id), product])),
    [products]
  );

  const draftTotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const product = productMap.get(line.product_id);
      const qty = Number(line.quantity);
      if (!product || !Number.isFinite(qty) || qty <= 0) return sum;
      return sum + product.selling_price * qty;
    }, 0);
  }, [lines, productMap]);

  function addLine() {
    setLines((current) => [
      ...current,
      { key: crypto.randomUUID(), product_id: '', quantity: '1' },
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

    const items = lines
      .filter((line) => line.product_id)
      .map((line) => ({
        product_id: Number(line.product_id),
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
      const payload = {
        customer_id: customerId ? Number(customerId) : undefined,
        payment_method: paymentMethod,
        items,
      };

      await saleApi.createSale(payload);
      pushToast('Sale recorded.', 'success');
      setCustomerId('');
      setPaymentMethod('Cash');
      setLines([{ key: crypto.randomUUID(), product_id: '', quantity: '1' }]);
      setLoading(true);
      await loadPage();
    } catch (err) {
      if (err instanceof ApiClientError) {
        const fieldErrors = mapFieldErrors(err.details);
        if (Object.keys(fieldErrors).length > 0) {
          const [field, message] = Object.entries(fieldErrors)[0];
          setFormError(`${field}: ${message}`);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Unable to record sale.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleViewSale(saleId: number) {
    setLoadingDetail(true);
    try {
      const fullSale = await saleApi.getSale(saleId);
      setSelectedSale(fullSale);
    } catch (err) {
      pushToast('Failed to load sale details.', 'error');
    } finally {
      setLoadingDetail(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view sales.</Alert>;
  }

  return (
    <div className="sales-page">
      <PageHeader
        title="Sales"
        subtitle="Record sales and review completed transaction history."
      />

      {canCreate ? (
        <Card title="New sale">
          <form className="sales-form" onSubmit={onCreateSale} noValidate>
            {formError ? <Alert tone="error">{formError}</Alert> : null}

            <div className="sales-form__meta">
              <label className="sales-select">
                <span>Customer (optional)</span>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
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
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </label>
            </div>

            <div className="sales-lines">
              {lines.map((line) => {
                const product = productMap.get(line.product_id);
                return (
                  <div className="sales-line" key={line.key}>
                    <label className="sales-select">
                      <span>Product</span>
                      <select
                        value={line.product_id}
                        onChange={(e) =>
                          updateLine(line.key, { product_id: e.target.value })
                        }
                      >
                        <option value="">Select product</option>
                        {products.map((item) => (
                          <option key={item.id} value={String(item.id)}>
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
              <Button type="submit" loading={saving} disabled={saving}>
                Record sale
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card title="Sales history">
        <div className="sales-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search sale ID, notes, or customer"
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
              rows={sales}
              rowKey={(row) => String(row.id)}
              emptyTitle="No sales yet"
              emptyDescription="Record your first sale to start building revenue history."
              columns={[
                {
                  key: 'number',
                  header: 'Sale',
                  render: (row) => (
                    <div>
                      <strong>#{row.id}</strong>
                      <div className="sales-muted">{formatDate(row.sale_datetime)}</div>
                    </div>
                  ),
                },
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (row) => row.customer_name || 'Walk-in',
                },
                {
                  key: 'total',
                  header: 'Total',
                  render: (row) => formatMoney(row.total_amount),
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
                    <Button 
                      variant="ghost" 
                      onClick={() => handleViewSale(row.id)}
                      disabled={loadingDetail}
                    >
                      View
                    </Button>
                  ),
                },
              ]}
            />

            <div className="sales-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} sales
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
        open={Boolean(selectedSale)}
        title={selectedSale ? `Sale #${selectedSale.id}` : 'Sale'}
        onClose={() => setSelectedSale(null)}
        width="lg"
      >
        {selectedSale ? (
          <div className="sales-detail">
            <p>
              <strong>Customer:</strong> {selectedSale.customer_name || 'Walk-in'}
            </p>
            <p>
              <strong>Sold:</strong> {formatDate(selectedSale.sale_datetime)}
            </p>
            <p>
              <strong>Recorded by:</strong> {selectedSale.user_name || '—'}
            </p>
            <p>
              <strong>Payment:</strong> {selectedSale.payment_method}
            </p>
            <DataTable
              rows={selectedSale.items}
              rowKey={(row) => String(row.id)}
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  render: (row) => `${row.product_name} (${row.sku})`,
                },
                {
                  key: 'price',
                  header: 'Unit price',
                  render: (row) => formatMoney(row.unit_price),
                },
                {
                  key: 'qty',
                  header: 'Qty',
                  render: (row) => row.quantity,
                },
                {
                  key: 'line',
                  header: 'Subtotal',
                  render: (row) => formatMoney(row.subtotal),
                },
              ]}
            />
            <div className="sales-detail__total">
              Total: <strong>{formatMoney(selectedSale.total_amount)}</strong>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}