import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as userApi from '../services/userService';
import type { AssignableRole, ManagedUser } from '../services/userService';
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
import './UsersPage.css';

type UserForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  roleIds: string[];
  isActive: boolean;
};

const emptyForm: UserForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  roleIds: [],
  isActive: true,
};

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { path?: string; message?: string }[]) {
    if (item.path && item.message) next[item.path] = item.message;
  }
  return next;
}

function formatRoleName(name: string) {
  return name
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' / ');
}

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('users.view');
  const canCreate = hasPermission('users.create');
  const canUpdate = hasPermission('users.update');
  const canDelete = hasPermission('users.delete');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<AssignableRole[]>([]);
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
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ManagedUser | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadRoles = useCallback(async () => {
    if (!canView) return;
    try {
      const result = await userApi.listAssignableRoles();
      setRoles(result.roles);
    } catch {
      setRoles([]);
    }
  }, [canView]);

  const loadUsers = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view users.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await userApi.listUsers({
        search: debouncedSearch || undefined,
        status,
        page,
        pageSize: 20,
      });
      setUsers(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, status, page]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      roleIds: roles[0] ? [roles[0].id] : [],
    });
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(managedUser: ManagedUser) {
    setEditing(managedUser);
    setForm({
      firstName: managedUser.firstName,
      lastName: managedUser.lastName,
      email: managedUser.email,
      phone: managedUser.phone || '',
      password: '',
      roleIds: managedUser.roleIds,
      isActive: managedUser.isActive,
    });
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function toggleRole(roleId: string) {
    setForm((current) => {
      const exists = current.roleIds.includes(roleId);
      const roleIds = exists
        ? current.roleIds.filter((id) => id !== roleId)
        : [...current.roleIds, roleId];
      return { ...current, roleIds };
    });
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (editing) {
        await userApi.updateUser(editing.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          roleIds: form.roleIds,
          isActive: form.isActive,
        });
        pushToast('User updated.', 'success');
      } else {
        await userApi.createUser({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          roleIds: form.roleIds,
        });
        pushToast('User created.', 'success');
      }
      setModalOpen(false);
      setLoading(true);
      await loadUsers();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to save user.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await userApi.deactivateUser(deactivateTarget.id);
      pushToast('User deactivated.', 'success');
      setDeactivateTarget(null);
      await loadUsers();
    } catch (err) {
      pushToast(err instanceof ApiClientError ? err.message : 'Unable to deactivate user.', 'error');
    } finally {
      setDeactivating(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view users.</Alert>;
  }

  return (
    <div className="users-page">
      <PageHeader
        title="Users"
        subtitle="Manage workspace accounts, roles, and access status."
        actions={canCreate ? <Button onClick={openCreate}>Add user</Button> : null}
      />

      <Card>
        <div className="users-toolbar">
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
          <label className="users-select">
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
              rows={users}
              rowKey={(row) => row.id}
              emptyTitle="No users found"
              emptyDescription="Create a user account to grant access to this business workspace."
              columns={[
                {
                  key: 'name',
                  header: 'User',
                  render: (row) => (
                    <div>
                      <Link to={`/app/users/${row.id}`}>
                        <strong>{row.fullName}</strong>
                      </Link>
                      <div className="users-muted">{row.email}</div>
                    </div>
                  ),
                },
                {
                  key: 'roles',
                  header: 'Roles',
                  render: (row) => (
                    <div className="users-role-badges">
                      {row.roles.map((role) => (
                        <Badge key={role} tone="neutral">
                          {formatRoleName(role)}
                        </Badge>
                      ))}
                    </div>
                  ),
                },
                {
                  key: 'phone',
                  header: 'Phone',
                  render: (row) => row.phone || '—',
                },
                {
                  key: 'lastLoginAt',
                  header: 'Last login',
                  render: (row) => formatDate(row.lastLoginAt),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <Badge tone={row.isActive ? 'green' : 'neutral'}>
                      {row.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row) => (
                    <div className="users-actions">
                      <Link className="ui-btn ui-btn--ghost" to={`/app/users/${row.id}`}>
                        View
                      </Link>
                      {canUpdate ? (
                        <Button variant="ghost" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                      ) : null}
                      {canDelete && row.isActive && row.id !== currentUser?.id ? (
                        <Button variant="ghost" onClick={() => setDeactivateTarget(row)}>
                          Deactivate
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />

            <div className="users-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} users
              </span>
              <div className="users-actions">
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
        title={editing ? 'Edit user' : 'Add user'}
        onClose={() => setModalOpen(false)}
        width="lg"
      >
        <form className="users-form" onSubmit={onSave} noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <div className="users-form__grid">
            <Input
              label="First name"
              name="firstName"
              value={form.firstName}
              onChange={(e) => setForm((current) => ({ ...current, firstName: e.target.value }))}
              error={fieldErrors.firstName}
              required
            />
            <Input
              label="Last name"
              name="lastName"
              value={form.lastName}
              onChange={(e) => setForm((current) => ({ ...current, lastName: e.target.value }))}
              error={fieldErrors.lastName}
              required
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
              error={fieldErrors.email}
              required
            />
            <Input
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
              error={fieldErrors.phone}
            />
            {!editing ? (
              <Input
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                error={fieldErrors.password}
                className="users-form__full"
                required
              />
            ) : (
              <label className="users-select users-form__full">
                <span>Status</span>
                <select
                  value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      isActive: e.target.value === 'ACTIVE',
                    }))
                  }
                  disabled={editing.id === currentUser?.id}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>
            )}
            <div className="users-form__full">
              <label className="users-select">
                <span>Roles</span>
              </label>
              {fieldErrors.roleIds ? (
                <Alert tone="error">{fieldErrors.roleIds}</Alert>
              ) : null}
              <div className="users-role-list">
                {roles.map((role) => (
                  <label key={role.id} className="users-role-option">
                    <input
                      type="checkbox"
                      checked={form.roleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                    <div>
                      <strong>{formatRoleName(role.name)}</strong>
                      {role.description ? <span>{role.description}</span> : null}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="users-form__actions">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Create user'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate user?"
        confirmLabel="Deactivate"
        danger
        loading={deactivating}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => void onConfirmDeactivate()}
      >
        {deactivateTarget
          ? `${deactivateTarget.fullName} will lose access until reactivated.`
          : null}
      </ConfirmDialog>
    </div>
  );
}
