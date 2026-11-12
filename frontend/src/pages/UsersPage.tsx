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
  name: string;
  email: string;
  password: string;
  roleId: number | null;
  status: string;
};

const emptyForm: UserForm = {
  name: '',
  email: '',
  password: '',
  roleId: null,
  status: 'active',
};

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { loc?: string[]; msg?: string }[]) {
    if (item.loc && item.msg) {
      next[String(item.loc[item.loc.length - 1])] = item.msg;
    }
  }
  return next;
}

function formatRoleName(name: string) {
  if (name === 'Staff') return 'Sales Staff';
  return name;
}

function isActiveStatus(status: string) {
  return status === 'active';
}

export function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('users.view');
  const canManage = hasPermission('users.manage');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 1,
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
      setRoles(result);
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
      roleId: roles[0]?.id ?? null,
    });
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(managedUser: ManagedUser) {
    setEditing(managedUser);
    setForm({
      name: managedUser.name,
      email: managedUser.email,
      password: '',
      roleId: managedUser.role.id,
      status: managedUser.status,
    });
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (form.roleId == null) {
      setFieldErrors({ role_id: 'Select a role.' });
      return;
    }
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (editing) {
        await userApi.updateUser(editing.id, {
          name: form.name,
          email: form.email,
          role_id: form.roleId,
          status: form.status,
        });
        pushToast('User updated.', 'success');
      } else {
        await userApi.createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role_id: form.roleId,
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
        subtitle="Create employee accounts, assign Manager or Sales Staff roles, and control access."
        actions={canManage ? <Button onClick={openCreate}>Add user</Button> : null}
      />

      <Card>
        <div className="users-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search name or email"
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
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
                        <strong>{row.name}</strong>
                      </Link>
                      <div className="users-muted">{row.email}</div>
                    </div>
                  ),
                },
                {
                  key: 'role',
                  header: 'Role',
                  render: (row) => (
                    <Badge tone="neutral">{formatRoleName(row.role.role_name)}</Badge>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <Badge tone={isActiveStatus(row.status) ? 'green' : 'neutral'}>
                      {row.status.toUpperCase()}
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
                      {canManage ? (
                        <Button variant="ghost" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                      ) : null}
                      {canManage && isActiveStatus(row.status) && row.id !== currentUser?.id ? (
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
                Page {pagination.page} of {pagination.total_pages} · {pagination.total} users
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
                  disabled={page >= pagination.total_pages}
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
              label="Full name"
              name="name"
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              error={fieldErrors.name}
              className="users-form__full"
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
            {!editing ? (
              <Input
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                error={fieldErrors.password}
                hint="At least 8 characters, with a letter and a number."
                required
              />
            ) : (
              <label className="users-select">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      status: e.target.value,
                    }))
                  }
                  disabled={editing.id === currentUser?.id}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            )}
            <div className="users-form__full">
              <label className="users-select">
                <span>Role</span>
              </label>
              {fieldErrors.role_id ? <Alert tone="error">{fieldErrors.role_id}</Alert> : null}
              {editing?.role.role_name === 'Business Owner' ? (
                <p className="users-muted">
                  Business Owner accounts keep that role. Assign Manager or Sales Staff to
                  employees only.
                </p>
              ) : (
                <div className="users-role-list">
                  {roles.map((role) => (
                    <label key={role.id} className="users-role-option">
                      <input
                        type="radio"
                        name="role_id"
                        checked={form.roleId === role.id}
                        onChange={() => setForm((current) => ({ ...current, roleId: role.id }))}
                      />
                      <div>
                        <strong>{formatRoleName(role.role_name)}</strong>
                        {role.description ? <span>{role.description}</span> : null}
                      </div>
                    </label>
                  ))}
                </div>
              )}
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
          ? `${deactivateTarget.name} will lose access until reactivated.`
          : null}
      </ConfirmDialog>
    </div>
  );
}
