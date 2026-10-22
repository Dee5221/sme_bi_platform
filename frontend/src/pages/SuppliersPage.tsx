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
  contact: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive';
};

const emptyForm: SupplierForm = {
  name: '',
  contact: '',
  email: '',
  phone: '',
  address: '',
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

export function SuppliersPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('suppliers.view');
  const canCreate = hasPermission('suppliers.create');
  const canUpdate = hasPermission('suppliers.update');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<Supplier | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const loadSuppliers = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view suppliers.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await supplierApi.listSuppliers();
      setSuppliers(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load suppliers.');
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const filteredSuppliers = suppliers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.contact.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q))
    );
  });

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
      contact: supplier.contact,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      status: supplier.status as 'active' | 'inactive',
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
      const payload: supplierApi.SupplierPayload = {
        name: form.name,
        contact: form.contact,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        status: form.status,
      };

      if (editing) {
        await supplierApi.updateSupplier(editing.id, payload);
        pushToast('Supplier updated.', 'success');
      } else {
        await supplierApi.createSupplier(payload);
        pushToast('Supplier created.', 'success');
      }
      setModalOpen(false);
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
      // Backend uses PATCH for status changes, not DELETE
      const payload = { status: 'inactive' } as supplierApi.SupplierPayload;
      await supplierApi.updateSupplier(deactivateTarget.id, payload);
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
        actions={canCreate ? <Button onClick={openCreate}>Add supplier</Button> : null}
      />

      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <Input
            label="Search"
            name="search"
            placeholder="Search name, contact, email, or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '320px' }}
          />
        </div>

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <DataTable
            rows={filteredSuppliers}
            rowKey={(row) => row.id}
            emptyTitle="No suppliers found"
            emptyDescription="Add your first supplier to link purchase records later."
            columns={[
              {
                key: 'name',
                header: 'Supplier',
                render: (row) => (
                  <div>
                    <strong>{row.name}</strong>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{row.contact}</div>
                  </div>
                ),
              },
              { key: 'email', header: 'Email', render: (row) => row.email || '—' },
              { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={row.status === 'active' ? 'green' : 'neutral'}>
                    {row.status}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (row) => (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {canUpdate ? (
                      <Button variant="secondary" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                    ) : null}
                    {row.status === 'active' ? (
                      <Button variant="secondary" onClick={() => setDeactivateTarget(row)}>
                        Deactivate
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit supplier' : 'Add supplier'}
        onClose={() => setModalOpen(false)}
        width="md"
      >
        <form onSubmit={onSave} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Input
            label="Name"
            name="name"
            value={form.name}
            onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            error={fieldErrors.name}
            required
          />
          <Input
            label="Contact Person"
            name="contact"
            value={form.contact}
            onChange={(e) => setForm((c) => ({ ...c, contact: e.target.value }))}
            error={fieldErrors.contact}
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
          {editing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as 'active' | 'inactive' }))}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
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
          ? `${deactivateTarget.name} will be marked inactive. Historical records will remain intact.`
          : null}
      </ConfirmDialog>
    </div>
  );
}