import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as customerApi from '../services/customerService';
import type { Customer } from '../services/customerService';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import './CustomersPage.css';

type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  type: string;
};

const emptyForm: CustomerForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  type: '',
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

export function CustomersPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('customers.view');
  const canCreate = hasPermission('customers.create');
  const canUpdate = hasPermission('customers.update');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view customers.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await customerApi.listCustomers();
      setCustomers(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load customers.');
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      type: customer.type || '',
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
      const payload: customerApi.CustomerPayload = {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        type: form.type || undefined,
      };

      if (editing) {
        await customerApi.updateCustomer(editing.id, payload);
        pushToast('Customer updated.', 'success');
      } else {
        await customerApi.createCustomer(payload);
        pushToast('Customer created.', 'success');
      }
      setModalOpen(false);
      await loadCustomers();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to save customer.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view customers.</Alert>;
  }

  return (
    <div className="customers-page">
      <PageHeader
        title="Customers"
        subtitle="Register and manage your customer records."
        actions={canCreate ? <Button onClick={openCreate}>Add customer</Button> : null}
      />

      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <Input
            label="Search"
            name="search"
            placeholder="Search name, email, or phone"
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
            rows={filteredCustomers}
            rowKey={(row) => row.id}
            emptyTitle="No customers found"
            emptyDescription="Add your first customer to track purchases later."
            columns={[
              {
                key: 'name',
                header: 'Customer',
                render: (row) => (
                  <div>
                    <strong>{row.name}</strong>
                    {row.type ? <div style={{ fontSize: '12px', color: '#64748b' }}>{row.type}</div> : null}
                  </div>
                ),
              },
              { key: 'email', header: 'Email', render: (row) => row.email || '—' },
              { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
              { key: 'address', header: 'Address', render: (row) => row.address || '—' },
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
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit customer' : 'Add customer'}
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
          <Input
            label="Type (e.g., retail, wholesale)"
            name="type"
            value={form.type}
            onChange={(e) => setForm((c) => ({ ...c, type: e.target.value }))}
            error={fieldErrors.type}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Create customer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}