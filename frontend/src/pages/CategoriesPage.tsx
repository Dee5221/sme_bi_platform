import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as productApi from '../services/productService';
import type { ProductCategory } from '../services/productService';
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
import './CustomersPage.css';

type CategoryForm = {
  name: string;
  status: 'active' | 'inactive';
};

const emptyForm: CategoryForm = {
  name: '',
  status: 'active',
};

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { loc?: string[]; msg?: string }[]) {
    if (item.loc && item.msg) {
      const field = item.loc[item.loc.length - 1];
      next[field] = item.msg;
    }
  }
  return next;
}

export function CategoriesPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();
  const canView = hasPermission('products.view');
  const canManage = hasPermission('products.manage');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ProductCategory | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view categories.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await productApi.listCategories(true);
      setCategories(result.categories);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load categories.');
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const filtered = categories.filter((category) => {
    if (!search) return true;
    return category.name.toLowerCase().includes(search.toLowerCase());
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(category: ProductCategory) {
    setEditing(category);
    setForm({ name: category.name, status: category.status });
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (editing) {
        await productApi.updateCategory(editing.id, form);
        pushToast('Category updated.', 'success');
      } else {
        await productApi.createCategory({ name: form.name, status: 'active' });
        pushToast('Category created.', 'success');
      }
      setModalOpen(false);
      await loadCategories();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to save category.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await productApi.deactivateCategory(deactivateTarget.id);
      pushToast('Category deactivated.', 'success');
      setDeactivateTarget(null);
      await loadCategories();
    } catch (err) {
      pushToast(
        err instanceof ApiClientError ? err.message : 'Unable to deactivate category.',
        'error'
      );
    } finally {
      setDeactivating(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view categories.</Alert>;
  }

  return (
    <div className="customers-page">
      <PageHeader
        title="Categories"
        subtitle="Group products so stock and sales reports stay consistent."
        actions={canManage ? <Button onClick={openCreate}>Add category</Button> : null}
      />

      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <Input
            label="Search"
            name="search"
            placeholder="Search category name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ maxWidth: '320px' }}
          />
        </div>

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <DataTable
            rows={filtered}
            rowKey={(row) => row.id}
            emptyTitle="No categories yet"
            emptyDescription="Create a category before adding products."
            columns={[
              {
                key: 'name',
                header: 'Category',
                render: (row) => <strong>{row.name}</strong>,
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
                render: (row) =>
                  canManage ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="secondary" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      {row.status === 'active' ? (
                        <Button variant="secondary" onClick={() => setDeactivateTarget(row)}>
                          Deactivate
                        </Button>
                      ) : null}
                    </div>
                  ) : null,
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit category' : 'Add category'}
        onClose={() => setModalOpen(false)}
        width="md"
      >
        <form onSubmit={onSave} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Input
            label="Name"
            name="name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            error={fieldErrors.name}
            required
          />
          {editing ? (
            <label className="customers-select">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as 'active' | 'inactive',
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate category?"
        confirmLabel="Deactivate"
        danger
        loading={deactivating}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => void onDeactivate()}
      >
        {deactivateTarget
          ? `${deactivateTarget.name} will be marked inactive. Existing products stay assigned.`
          : null}
      </ConfirmDialog>
    </div>
  );
}
