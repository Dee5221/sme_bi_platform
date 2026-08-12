import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError, mediaUrl } from '../lib/api';
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
  description: string;
  unit: string;
  price: string;
  categoryId: string;
  status: 'ACTIVE' | 'INACTIVE';
};

type CategoryForm = {
  name: string;
  description: string;
};

const emptyProductForm: ProductForm = {
  name: '',
  sku: '',
  description: '',
  unit: '',
  price: '',
  categoryId: '',
  status: 'ACTIVE',
};

const emptyCategoryForm: CategoryForm = {
  name: '',
  description: '',
};

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { path?: string; message?: string }[]) {
    if (item.path && item.message) next[item.path] = item.message;
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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
      setProducts(productResult.items);
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
    () => categories.filter((category) => category.isActive),
    [categories]
  );

  function openCreateProduct() {
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setImageFile(null);
    setImagePreview(null);
    setFormError(null);
    setFieldErrors({});
    setProductModalOpen(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      sku: product.sku,
      description: product.description || '',
      unit: product.unit || '',
      price: String(product.price),
      categoryId: product.categoryId || '',
      status: product.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
    setImageFile(null);
    setImagePreview(mediaUrl(product.imageUrl));
    setFormError(null);
    setFieldErrors({});
    setProductModalOpen(true);
  }

  function onProductImageChange(file: File | null) {
    setImageFile(file);
    if (!file) {
      setImagePreview(editingProduct ? mediaUrl(editingProduct.imageUrl) : null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  }

  async function onSaveProduct(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const price = Number(productForm.price);
    if (Number.isNaN(price)) {
      setFieldErrors({ price: 'Enter a valid price.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: productForm.name,
        sku: productForm.sku,
        description: productForm.description || undefined,
        unit: productForm.unit || undefined,
        price,
        categoryId: productForm.categoryId || undefined,
        ...(editingProduct && canDelete ? { status: productForm.status } : {}),
      };

      let productId = editingProduct?.id;
      if (editingProduct) {
        await productApi.updateProduct(editingProduct.id, payload);
        pushToast('Product updated.', 'success');
      } else {
        const created = await productApi.createProduct(payload);
        productId = created.product.id;
        pushToast('Product created.', 'success');
      }

      if (imageFile && productId) {
        await productApi.uploadProductImage(productId, imageFile);
        pushToast(editingProduct ? 'Product image updated.' : 'Product image uploaded.', 'success');
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
        description: categoryForm.description || undefined,
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
                <option key={category.id} value={category.id}>
                  {category.name}
                  {!category.isActive ? ' (inactive)' : ''}
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
                      <div className="products-thumb" aria-hidden="true">
                        {mediaUrl(row.imageUrl) ? (
                          <img src={mediaUrl(row.imageUrl) || ''} alt="" />
                        ) : (
                          <span>▦</span>
                        )}
                      </div>
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
                  key: 'price',
                  header: 'Price',
                  render: (row) => formatMoney(row.price),
                },
                {
                  key: 'stock',
                  header: 'Stock',
                  render: (row) => row.inventory?.quantity ?? 0,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <Badge tone={row.status === 'ACTIVE' ? 'green' : 'neutral'}>
                      {row.status}
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
                      {canDelete && row.status === 'ACTIVE' ? (
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
          <div className="products-image-field">
            <div className="products-image-preview" aria-hidden="true">
              {imagePreview ? <img src={imagePreview} alt="" /> : <span>No image</span>}
            </div>
            <div className="products-image-field__meta">
              <strong>Product image</strong>
              <span>JPEG, PNG, WebP, or GIF · up to 5MB</span>
              <label className="products-image-upload">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    event.target.value = '';
                    onProductImageChange(file);
                  }}
                />
                <span>{imageFile ? 'Change image' : 'Choose image'}</span>
              </label>
              {imageFile ? (
                <button
                  type="button"
                  className="products-image-clear"
                  onClick={() => onProductImageChange(null)}
                >
                  Remove selected image
                </button>
              ) : null}
            </div>
          </div>
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
              label="Price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={productForm.price}
              onChange={(e) => setProductForm((c) => ({ ...c, price: e.target.value }))}
              error={fieldErrors.price}
              required
            />
            <Input
              label="Unit"
              name="unit"
              placeholder="e.g. pcs, kg, bag"
              value={productForm.unit}
              onChange={(e) => setProductForm((c) => ({ ...c, unit: e.target.value }))}
              error={fieldErrors.unit}
            />
            <label className="products-select products-select--full">
              <span>Category</span>
              <select
                value={productForm.categoryId}
                onChange={(e) =>
                  setProductForm((c) => ({ ...c, categoryId: e.target.value }))
                }
              >
                <option value="">No category</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            {editingProduct && canDelete ? (
              <label className="products-select">
                <span>Status</span>
                <select
                  value={productForm.status}
                  onChange={(e) =>
                    setProductForm((c) => ({
                      ...c,
                      status: e.target.value as 'ACTIVE' | 'INACTIVE',
                    }))
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>
            ) : null}
            <Input
              label="Description"
              name="description"
              value={productForm.description}
              onChange={(e) =>
                setProductForm((c) => ({ ...c, description: e.target.value }))
              }
              error={fieldErrors.description}
              className="products-form__full"
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
          <Input
            label="Description"
            name="description"
            value={categoryForm.description}
            onChange={(e) =>
              setCategoryForm((c) => ({ ...c, description: e.target.value }))
            }
            error={fieldErrors.description}
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
