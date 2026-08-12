import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as customerApi from '../services/customerService';
import type { Customer } from '../services/customerService';
import * as productApi from '../services/productService';
import type { Product } from '../services/productService';
import * as saleApi from '../services/saleService';
import type { Sale } from '../services/saleService';
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

function formatDate(value: string) {
  return new Date(value).toLocaleString();
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

export function StaffSalesPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('sales.view');
  const canCreate = hasPermission('sales.create');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(emptyLines);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadSales = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view sales.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await saleApi.listSales({
        search: debouncedSearch || undefined,
        page,
        pageSize: 20,
      });
      setSales(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load sales.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, page]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  const loadCatalog = useCallback(async () => {
    if (!canCreate) return;
    const [productsResult, customersResult] = await Promise.all([
      productApi.listProducts({ status: 'ACTIVE', pageSize: 100 }),
      customerApi.listCustomers({ status: 'ACTIVE', pageSize: 100 }),
    ]);
    setProducts(productsResult.items);
    setCustomers(customersResult.items);
  }, [canCreate]);

  function openCreate() {
    setCustomerId('');
    setNotes('');
    setLines(emptyLines());
    setFormError(null);
    setFieldErrors({});
    setCreateOpen(true);
    void loadCatalog();
  }

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
      setCreateOpen(false);
      setLoading(true);
      await loadSales();
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

  if (!canView) {
    return <Alert tone="error">You do not have permission to view sales.</Alert>;
  }

  return (
    <div className="sales-page">
      <PageHeader
        title="Sales"
        subtitle="Review recent transactions and record a new sale for this business."
        actions={
          canCreate ? <Button onClick={openCreate}>New sale</Button> : null
        }
      />

      <Card>
        <div className="sales-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search sale number, notes, or customer"
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
              rowKey={(row) => row.id}
              emptyTitle="No sales yet"
              emptyDescription="Record a sale to start today's transaction list."
              columns={[
                {
                  key: 'number',
                  header: 'Sale',
                  render: (row) => (
                    <div>
                      <strong>{row.saleNumber}</strong>
                      <div className="sales-muted">{formatDate(row.soldAt)}</div>
                    </div>
                  ),
                },
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (row) => row.customer?.name || 'Walk-in',
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
                    <Button variant="ghost" onClick={() => setSelectedSale(row)}>
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
        open={createOpen}
        title="New sale"
        onClose={() => setCreateOpen(false)}
        width="lg"
      >
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
            <Button type="submit" loading={saving}>
              Record sale
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedSale)}
        title={selectedSale ? selectedSale.saleNumber : 'Sale'}
        onClose={() => setSelectedSale(null)}
        width="lg"
      >
        {selectedSale ? (
          <div className="sales-detail">
            <p>
              <strong>Customer:</strong> {selectedSale.customer?.name || 'Walk-in'}
            </p>
            <p>
              <strong>Sold:</strong> {formatDate(selectedSale.soldAt)}
            </p>
            <p>
              <strong>Recorded by:</strong> {selectedSale.createdBy?.name || '—'}
            </p>
            {selectedSale.notes ? (
              <p>
                <strong>Notes:</strong> {selectedSale.notes}
              </p>
            ) : null}
            <DataTable
              rows={selectedSale.items}
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
              Total: <strong>{formatMoney(selectedSale.total)}</strong>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
