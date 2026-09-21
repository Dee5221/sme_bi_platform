import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as productApi from '../services/productService';
import type { Product, ProductCategory } from '../services/productService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import './ProductsPage.css';

type ProductForm = {
  name: string;
  sku: string;
  cost_price: string;
  selling_price: string;
  reorder_level: string;
  categoryId: string;
  status: 'active' | 'inactive';
};

type CategoryForm = {
  name: string;
};

const emptyProductForm: ProductForm = {
  name: '',
  sku: '',
  cost_price: '0.00',
  selling_price: '0.00',
  reorder_level: '0.00',
  categoryId: '',
  status: 'active',
};

const emptyCategoryForm: CategoryForm = {
  name: '',
};

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { loc?: string[]; msg?: string }[]) {
    if (item.loc && item.msg) {
      // FastAPI returns loc as ['body', 'field_name'] or ['query', 'field_name']
      const fieldName = item.loc[item.loc.length - 1];
      next[fieldName] = item.msg;
    }
  }
  return next;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('products.view');
  const canCreate = hasPermission('products.create');
  const canUpdate = hasPermission('products.update');
  const canDelete = hasPermission('products.delete');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view products.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [productResult, categoryResult] = await Promise.all([
        productApi.listProducts({
          search: debouncedSearch || undefined,
          status,
          categoryId: categoryFilter || undefined,
          page,
          pageSize: 20,
        }),
        productApi.listCategories(true),
      ]);
      
      // Enrich products with category names for the UI
      const categoryMap = new Map(categoryResult.categories.map(c => [c.id, c.name]));
      const enrichedProducts = productResult.items.map(p => ({
        ...p,
        category: p.category_id ? { id: p.category_id, name: categoryMap.get(p.category_id) || 'Unknown' } : null
      }));

      setProducts(enrichedProducts);
      setPagination(productResult.pagination);
      setCategories(categoryResult.categories);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, status, categoryFilter, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.status === 'active'),
    [categories]
  );

  function openCreateProduct() {
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setFormError(null);
    setFieldErrors({});
    setProductModalOpen(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      sku: product.sku,
      cost_price: String(product.cost_price),
      selling_price: String(product.selling_price),
      reorder_level: String(product.reorder_level),
      categoryId: String(product.category_id),
      status: product.status,
    });
    setFormError(null);
    setFieldErrors({});
    setProductModalOpen(true);
  }

  async function onSaveProduct(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    
    const costPrice = Number(productForm.cost_price);
    const sellingPrice = Number(productForm.selling_price);
    const reorderLevel = Number(productForm.reorder_level);
    const categoryId = Number(productForm.categoryId);

    if (Number.isNaN(costPrice) || costPrice < 0) {
      setFieldErrors({ cost_price: 'Enter a valid cost price.' });
      return;
    }
    if (Number.isNaN(sellingPrice) || sellingPrice < 0) {
      setFieldErrors({ selling_price: 'Enter a valid selling price.' });
      return;
    }
    if (Number.isNaN(reorderLevel) || reorderLevel < 0) {
      setFieldErrors({ reorder_level: 'Enter a valid reorder level.' });
      return;
    }
    if (Number.isNaN(categoryId)) {
      setFieldErrors({ categoryId: 'Please select a category.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: productForm.name,
        sku: productForm.sku,
        cost_price: costPrice,
        selling_price: sellingPrice,
        reorder_level: reorderLevel,
        category_id: categoryId,
        status: productForm.status,
      };

      if (editingProduct) {
        await productApi.updateProduct(editingProduct.id, payload);
        pushToast('Product updated.', 'success');
      } else {
        await productApi.createProduct(payload);
        pushToast('Product created.', 'success');
      }

      setProductModalOpen(false);
      setLoading(true);
      await loadData();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to save product.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onSaveCategory(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      await productApi.createCategory({
        name: categoryForm.name,
        status: 'active',
      });
      pushToast('Category created.', 'success');
      setCategoryModalOpen(false);
      setCategoryForm(emptyCategoryForm);
      await loadData();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to create category.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await productApi.deactivateProduct(deactivateTarget.id);
      pushToast('Product deactivated.', 'success');
      setDeactivateTarget(null);
      await loadData();
    } catch (err) {
      pushToast(
        err instanceof ApiClientError ? err.message : 'Unable to deactivate product.',
        'error'
      );
    } finally {
      setDeactivating(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view products.</Alert>;
  }

  return (
    <div className="products-page">
      <PageHeader
        title="Products"
        subtitle="Manage your catalog, categories, and pricing."
        actions={
          <>
            {canCreate ? (
              <Button variant="secondary" onClick={() => setCategoryModalOpen(true)}>
                Add category
              </Button>
            ) : null}
            {canCreate ? <Button onClick={openCreateProduct}>Add product</Button> : null}
          </>
        }
      />

      <Card>
        <div className="products-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search name or SKU"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <label className="products-select">
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ALL">All</option>
            </select>
          </label>
          <label className="products-select">
            <span>Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setPage(1);
                setCategoryFilter(e.target.value);
              }}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                  {category.status === 'inactive' ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <>
            <DataTable
              rows={products}
              rowKey={(row) => row.id}
              emptyTitle="No products yet"
              emptyDescription="Create your first product to start building inventory and sales data."
              columns={[
                {
                  key: 'name',
                  header: 'Product',
                  render: (row) => (
                    <div className="products-name-cell">
                      <div>
                        <strong>{row.name}</strong>
                        <div className="products-muted">{row.sku}</div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'category',
                  header: 'Category',
                  render: (row) => row.category?.name || '—',
                },
                {
                  key: 'selling_price',
                  header: 'Price',
                  render: (row) => formatMoney(row.selling_price),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <Badge tone={row.status === 'active' ? 'green' : 'neutral'}>
                      {row.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row) => (
                    <div className="products-actions">
                      {canUpdate ? (
                        <Button variant="ghost" onClick={() => openEditProduct(row)}>
                          Edit
                        </Button>
                      ) : null}
                      {canDelete && row.status === 'active' ? (
                        <Button variant="ghost" onClick={() => setDeactivateTarget(row)}>
                          Deactivate
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />

            <div className="products-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} products
              </span>
              <div className="products-actions">
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
        open={productModalOpen}
        title={editingProduct ? 'Edit product' : 'Add product'}
        onClose={() => setProductModalOpen(false)}
        width="lg"
      >
        <form className="products-form" onSubmit={onSaveProduct} noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <div className="products-form__grid">
            <Input
              label="Name"
              name="name"
              value={productForm.name}
              onChange={(e) => setProductForm((c) => ({ ...c, name: e.target.value }))}
              error={fieldErrors.name}
              required
            />
            <Input
              label="SKU"
              name="sku"
              value={productForm.sku}
              onChange={(e) => setProductForm((c) => ({ ...c, sku: e.target.value }))}
              error={fieldErrors.sku}
              required
            />
            <Input
              label="Cost Price"
              name="cost_price"
              type="number"
              min="0"
              step="0.01"
              value={productForm.cost_price}
              onChange={(e) => setProductForm((c) => ({ ...c, cost_price: e.target.value }))}
              error={fieldErrors.cost_price}
              required
            />
            <Input
              label="Selling Price"
              name="selling_price"
              type="number"
              min="0"
              step="0.01"
              value={productForm.selling_price}
              onChange={(e) => setProductForm((c) => ({ ...c, selling_price: e.target.value }))}
              error={fieldErrors.selling_price}
              required
            />
            <Input
              label="Reorder Level"
              name="reorder_level"
              type="number"
              min="0"
              step="0.01"
              value={productForm.reorder_level}
              onChange={(e) => setProductForm((c) => ({ ...c, reorder_level: e.target.value }))}
              error={fieldErrors.reorder_level}
              required
            />
            <label className="products-select products-select--full">
              <span>Category *</span>
              <select
                value={productForm.categoryId}
                onChange={(e) =>
                  setProductForm((c) => ({ ...c, categoryId: e.target.value }))
                }
                required
              >
                <option value="">Select a category</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
              {fieldErrors.category_id && <span className="input-error">{fieldErrors.category_id}</span>}
            </label>
            {editingProduct && canDelete ? (
              <label className="products-select">
                <span>Status</span>
                <select
                  value={productForm.status}
                  onChange={(e) =>
                    setProductForm((c) => ({
                      ...c,
                      status: e.target.value as 'active' | 'inactive',
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            ) : null}
            <Input
              label="Description (Optional)"
              name="description"
              value={productForm.name} 
              // Note: Backend doesn't store description in MVP, but we keep the field for UI consistency without sending it
              onChange={() => {}} 
              className="products-form__full"
              disabled
              placeholder="Description field reserved for future enhancement"
            />
          </div>
          <div className="products-form__actions">
            <Button variant="secondary" type="button" onClick={() => setProductModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingProduct ? 'Save changes' : 'Create product'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={categoryModalOpen}
        title="Add category"
        onClose={() => setCategoryModalOpen(false)}
      >
        <form className="products-form" onSubmit={onSaveCategory} noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Input
            label="Category name"
            name="name"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm((c) => ({ ...c, name: e.target.value }))}
            error={fieldErrors.name}
            required
          />
          <div className="products-form__actions">
            <Button variant="secondary" type="button" onClick={() => setCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create category
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate product?"
        confirmLabel="Deactivate"
        danger
        loading={deactivating}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => void onConfirmDeactivate()}
      >
        {deactivateTarget
          ? `${deactivateTarget.name} will be marked inactive. Historical records stay intact.`
          : null}
      </ConfirmDialog>
    </div>
  );
}