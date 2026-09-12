import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as userApi from '../services/userService';
import type {
  AssignableRole,
  ManagedUser,
  UserActivityEntry,
} from '../services/userService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import './DashboardPage.css';
import './UserDetailsPage.css';
import './UsersPage.css';

type EditForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleIds: string[];
  isActive: boolean;
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

function formatAction(action: string) {
  return action.replace(/\./g, ' · ').replace(/_/g, ' ').toLowerCase();
}

export function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('users.view');
  const canUpdate = hasPermission('users.update');
  const canDelete = hasPermission('users.delete');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managedUser, setManagedUser] = useState<ManagedUser | null>(null);
  const [recentActivity, setRecentActivity] = useState<UserActivityEntry[]>([]);
  const [roles, setRoles] = useState<AssignableRole[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!canView || !id) {
      setError('You do not have permission to view this user.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await userApi.fetchUser(id);
      setManagedUser(result.user);
      setRecentActivity(result.recentActivity);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load user details.');
      setManagedUser(null);
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  }, [canView, id]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    if (!canView) return;
    void userApi.listAssignableRoles().then((result) => setRoles(result.roles));
  }, [canView]);

  function openEdit() {
    if (!managedUser) return;
    setForm({
      firstName: managedUser.firstName,
      lastName: managedUser.lastName,
      email: managedUser.email,
      phone: managedUser.phone || '',
      roleIds: managedUser.roleIds,
      isActive: managedUser.isActive,
    });
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function toggleRole(roleId: string) {
    setForm((current) => {
      if (!current) return current;
      const exists = current.roleIds.includes(roleId);
      const roleIds = exists
        ? current.roleIds.filter((value) => value !== roleId)
        : [...current.roleIds, roleId];
      return { ...current, roleIds };
    });
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!id || !form) return;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const result = await userApi.updateUser(id, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        roleIds: form.roleIds,
        isActive: form.isActive,
      });
      setManagedUser(result.user);
      setModalOpen(false);
      pushToast('User updated.', 'success');
      setLoading(true);
      await loadDetails();
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
    if (!id) return;
    setDeactivating(true);
    try {
      await userApi.deactivateUser(id);
      pushToast('User deactivated.', 'success');
      setConfirmDeactivate(false);
      setLoading(true);
      await loadDetails();
    } catch (err) {
      pushToast(err instanceof ApiClientError ? err.message : 'Unable to deactivate user.', 'error');
    } finally {
      setDeactivating(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view user details.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={8} />
      </Card>
    );
  }

  if (error || !managedUser) {
    return (
      <div className="user-details-page">
        <Link className="user-details-back" to="/app/users">
          ← Back to users
        </Link>
        <Alert tone="error">{error || 'User not found.'}</Alert>
      </div>
    );
  }

  const isSelf = managedUser.id === currentUser?.id;

  return (
    <div className="user-details-page">
      <Link className="user-details-back" to="/app/users">
        ← Back to users
      </Link>

      <PageHeader
        title={managedUser.fullName}
        subtitle={managedUser.email}
        actions={
          <div className="user-details-actions">
            {canUpdate ? (
              <Button variant="secondary" onClick={openEdit}>
                Edit user
              </Button>
            ) : null}
            {canDelete && managedUser.isActive && !isSelf ? (
              <Button variant="secondary" onClick={() => setConfirmDeactivate(true)}>
                Deactivate
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="user-details-layout">
        <div className="user-details-main">
          <Card title="Account profile">
            <div className="user-details-grid">
              <div className="user-details-field">
                <span>First name</span>
                <strong>{managedUser.firstName}</strong>
              </div>
              <div className="user-details-field">
                <span>Last name</span>
                <strong>{managedUser.lastName}</strong>
              </div>
              <div className="user-details-field">
                <span>Email</span>
                <strong>{managedUser.email}</strong>
              </div>
              <div className="user-details-field">
                <span>Phone</span>
                <strong>{managedUser.phone || '—'}</strong>
              </div>
            </div>
          </Card>

          <Card title="Assigned roles">
            <div className="users-role-badges">
              {managedUser.roles.map((role) => (
                <Badge key={role} tone="neutral">
                  {formatRoleName(role)}
                </Badge>
              ))}
            </div>
          </Card>

          <Card title="Recent activity">
            {recentActivity.length === 0 ? (
              <EmptyState
                title="No activity recorded"
                description="Actions performed by or on this user will appear here."
              />
            ) : (
              <ul className="recent-list">
                {recentActivity.map((entry) => (
                  <li key={entry.id} className="recent-list__item">
                    <div className="recent-list__icon" aria-hidden="true">
                      •
                    </div>
                    <div className="recent-list__body">
                      <strong>{formatAction(entry.action)}</strong>
                      <span>
                        {entry.entity}
                        {entry.entityId ? ` · ${entry.entityId}` : ''} · {entry.actorName}
                      </span>
                    </div>
                    <div className="recent-list__meta">
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="user-details-side">
          <Card title="Access status">
            <div className="user-details-grid">
              <div className="user-details-field">
                <span>Status</span>
                <Badge tone={managedUser.isActive ? 'green' : 'neutral'}>
                  {managedUser.isActive ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </div>
              <div className="user-details-field">
                <span>Last login</span>
                <strong>{formatDate(managedUser.lastLoginAt)}</strong>
              </div>
              <div className="user-details-field">
                <span>Created</span>
                <strong>{formatDate(managedUser.createdAt)}</strong>
              </div>
              <div className="user-details-field">
                <span>Last updated</span>
                <strong>{formatDate(managedUser.updatedAt)}</strong>
              </div>
            </div>
          </Card>

          {isSelf ? (
            <Card title="Your account">
              <p className="users-muted">
                You are viewing your own user record. Status and deactivation controls are
                limited here to prevent locking yourself out.
              </p>
              <div className="side-link">
                <Link to="/app/profile">Go to profile settings →</Link>
              </div>
            </Card>
          ) : null}
        </aside>
      </div>

      <Modal open={modalOpen} title="Edit user" onClose={() => setModalOpen(false)} width="lg">
        {form ? (
          <form className="users-form" onSubmit={onSave} noValidate>
            {formError ? <Alert tone="error">{formError}</Alert> : null}
            <div className="users-form__grid">
              <Input
                label="First name"
                name="firstName"
                value={form.firstName}
                onChange={(e) => setForm((current) => current && { ...current, firstName: e.target.value })}
                error={fieldErrors.firstName}
                required
              />
              <Input
                label="Last name"
                name="lastName"
                value={form.lastName}
                onChange={(e) => setForm((current) => current && { ...current, lastName: e.target.value })}
                error={fieldErrors.lastName}
                required
              />
              <Input
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => current && { ...current, email: e.target.value })}
                error={fieldErrors.email}
                required
              />
              <Input
                label="Phone"
                name="phone"
                value={form.phone}
                onChange={(e) => setForm((current) => current && { ...current, phone: e.target.value })}
                error={fieldErrors.phone}
              />
              <label className="users-select users-form__full">
                <span>Status</span>
                <select
                  value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) =>
                    setForm((current) =>
                      current
                        ? { ...current, isActive: e.target.value === 'ACTIVE' }
                        : current
                    )
                  }
                  disabled={isSelf}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>
              <div className="users-form__full">
                <label className="users-select">
                  <span>Roles</span>
                </label>
                {fieldErrors.roleIds ? <Alert tone="error">{fieldErrors.roleIds}</Alert> : null}
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
                Save changes
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmDeactivate}
        title="Deactivate user?"
        confirmLabel="Deactivate"
        danger
        loading={deactivating}
        onCancel={() => setConfirmDeactivate(false)}
        onConfirm={() => void onConfirmDeactivate()}
      >
        {managedUser.fullName} will lose access until reactivated.
      </ConfirmDialog>
    </div>
  );
}
