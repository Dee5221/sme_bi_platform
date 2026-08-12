import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as supplierApi from '../services/supplierService';
import type { Supplier } from '../services/supplierService';
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
import './SuppliersPage.css';

type SupplierForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const emptyForm: SupplierForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
  status: 'ACTIVE',
};

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { path?: string; message?: string }[]) {
    if (item.path && item.message) next[item.path] = item.message;
  }
  return next;
}

export function SuppliersPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('suppliers.view');
  const canCreate = hasPermission('suppliers.create');
  const canUpdate = hasPermission('suppliers.update');
  const canDelete = hasPermission('suppliers.delete');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Supplier | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadSuppliers = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view suppliers.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await supplierApi.listSuppliers({
        search: debouncedSearch || undefined,
        status,
        page,
        pageSize: 20,
      });
      setSuppliers(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load suppliers.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, status, page]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      status: supplier.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
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
      const payload = {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        ...(editing && canDelete ? { status: form.status } : {}),
      };
      if (editing) {
        await supplierApi.updateSupplier(editing.id, payload);
        pushToast('Supplier updated.', 'success');
      } else {
        await supplierApi.createSupplier(payload);
        pushToast('Supplier created.', 'success');
      }
      setModalOpen(false);
      setLoading(true);
      await loadSuppliers();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to save supplier.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await supplierApi.deactivateSupplier(deactivateTarget.id);
      pushToast('Supplier deactivated.', 'success');
      setDeactivateTarget(null);
      await loadSuppliers();
    } catch (err) {
      pushToast(
        err instanceof ApiClientError ? err.message : 'Unable to deactivate supplier.',
        'error'
      );
    } finally {
      setDeactivating(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view suppliers.</Alert>;
  }

  return (
    <div className="suppliers-page">
      <PageHeader
        title="Suppliers"
        subtitle="Register and manage your supplier records."
        actions={
          canCreate ? <Button onClick={openCreate}>Add supplier</Button> : null
        }
      />

      <Card>
        <div className="suppliers-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search name, email, or phone"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <label className="suppliers-select">
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
        </div>

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <>
            <DataTable
              rows={suppliers}
              rowKey={(row) => row.id}
              emptyTitle="No suppliers yet"
              emptyDescription="Add your first supplier to link purchase records later."
              columns={[
                {
                  key: 'name',
                  header: 'Supplier',
                  render: (row) => (
                    <div>
                      <strong>{row.name}</strong>
                      {row.notes ? <div className="suppliers-muted">{row.notes}</div> : null}
                    </div>
                  ),
                },
                {
                  key: 'email',
                  header: 'Email',
                  render: (row) => row.email || '—',
                },
                {
                  key: 'phone',
                  header: 'Phone',
                  render: (row) => row.phone || '—',
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
                    <div className="suppliers-actions">
                      {canUpdate ? (
                        <Button variant="ghost" onClick={() => openEdit(row)}>
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

            <div className="suppliers-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} suppliers
              </span>
              <div className="suppliers-actions">
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
        open={modalOpen}
        title={editing ? 'Edit supplier' : 'Add supplier'}
        onClose={() => setModalOpen(false)}
        width="lg"
      >
        <form className="suppliers-form" onSubmit={onSave} noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <div className="suppliers-form__grid">
            <Input
              label="Name"
              name="name"
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              error={fieldErrors.name}
              required
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              error={fieldErrors.email}
            />
            <Input
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
              error={fieldErrors.phone}
            />
            <Input
              label="Address"
              name="address"
              value={form.address}
              onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))}
              error={fieldErrors.address}
            />
            {editing && canDelete ? (
              <label className="suppliers-select">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((c) => ({
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
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
              error={fieldErrors.notes}
              className="suppliers-form__full"
            />
          </div>
          <div className="suppliers-form__actions">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Create supplier'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate supplier?"
        confirmLabel="Deactivate"
        danger
        loading={deactivating}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => void onConfirmDeactivate()}
      >
        {deactivateTarget
          ? `${deactivateTarget.name} will be marked inactive. Purchase records will remain intact.`
          : null}
      </ConfirmDialog>
    </div>
  );
}

