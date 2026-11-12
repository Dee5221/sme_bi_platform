import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as userApi from '../services/userService';
import type { AssignableRole, ManagedUser, UserActivityEntry } from '../services/userService';
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
import './dashboard.css';
import './UserDetailsPage.css';
import './UsersPage.css';

type EditForm = {
  name: string;
  email: string;
  roleId: number;
  status: string;
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

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatAction(action: string) {
  return action.replace(/\./g, ' · ').replace(/_/g, ' ');
}

function isActiveStatus(status: string) {
  return status === 'active';
}

export function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('users.view');
  const canManage = hasPermission('users.manage');

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
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

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
      setRecentActivity(result.recent_activity);
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
    void userApi.listAssignableRoles().then((result) => setRoles(result));
  }, [canView]);

  function openEdit() {
    if (!managedUser) return;
    setForm({
      name: managedUser.name,
      email: managedUser.email,
      roleId: managedUser.role.id,
      status: managedUser.status,
    });
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!id || !form) return;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const result = await userApi.updateUser(id, {
        name: form.name,
        email: form.email,
        role_id: form.roleId,
        status: form.status,
      });
      setManagedUser(result);
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

  async function onResetPassword(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setResetting(true);
    setResetError(null);
    try {
      await userApi.resetUserPassword(id, newPassword);
      pushToast('Password reset. The previous password will no longer work.', 'success');
      setResetOpen(false);
      setNewPassword('');
      setLoading(true);
      await loadDetails();
    } catch (err) {
      setResetError(err instanceof ApiClientError ? err.message : 'Unable to reset password.');
    } finally {
      setResetting(false);
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
  const isOwnerAccount = managedUser.role.role_name === 'Business Owner';

  return (
    <div className="user-details-page">
      <Link className="user-details-back" to="/app/users">
        ← Back to users
      </Link>

      <PageHeader
        title={managedUser.name}
        subtitle={managedUser.email}
        actions={
          <div className="user-details-actions">
            {canManage ? (
              <Button variant="secondary" onClick={openEdit}>
                Edit user
              </Button>
            ) : null}
            {canManage && !isSelf ? (
              <Button variant="secondary" onClick={() => { setResetError(null); setResetOpen(true); }}>
                Reset password
              </Button>
            ) : null}
            {canManage && isActiveStatus(managedUser.status) && !isSelf ? (
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
                <span>Name</span>
                <strong>{managedUser.name}</strong>
              </div>
              <div className="user-details-field">
                <span>Email</span>
                <strong>{managedUser.email}</strong>
              </div>
              <div className="user-details-field">
                <span>Role</span>
                <Badge tone="neutral">{formatRoleName(managedUser.role.role_name)}</Badge>
              </div>
            </div>
          </Card>

          <Card title="Account activity">
            {recentActivity.length === 0 ? (
              <EmptyState
                title="No activity recorded"
                description="Administrative changes to this account will appear here."
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
                        {entry.entity_id ? ` · ${entry.entity_id}` : ''} · {entry.actor_name}
                      </span>
                    </div>
                    <div className="recent-list__meta">
                      <span>{formatDate(entry.created_at)}</span>
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
                <Badge tone={isActiveStatus(managedUser.status) ? 'green' : 'neutral'}>
                  {managedUser.status.toUpperCase()}
                </Badge>
              </div>
              <div className="user-details-field">
                <span>Created</span>
                <strong>{formatDate(managedUser.created_at)}</strong>
              </div>
              <div className="user-details-field">
                <span>Last updated</span>
                <strong>{formatDate(managedUser.updated_at)}</strong>
              </div>
            </div>
          </Card>

          {isSelf ? (
            <Card title="Your account">
              <p className="users-muted">
                You are viewing your own user record. Status and password-reset controls are
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
                label="Full name"
                name="name"
                value={form.name}
                onChange={(e) => setForm((current) => current && { ...current, name: e.target.value })}
                error={fieldErrors.name}
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
              <label className="users-select users-form__full">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((current) =>
                      current ? { ...current, status: e.target.value } : current
                    )
                  }
                  disabled={isSelf}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <div className="users-form__full">
                <label className="users-select">
                  <span>Role</span>
                </label>
                {fieldErrors.role_id ? <Alert tone="error">{fieldErrors.role_id}</Alert> : null}
                {isOwnerAccount ? (
                  <p className="users-muted">
                    The last active Business Owner cannot be demoted from this screen.
                  </p>
                ) : (
                  <div className="users-role-list">
                    {roles.map((role) => (
                      <label key={role.id} className="users-role-option">
                        <input
                          type="radio"
                          name="role_id"
                          checked={form.roleId === role.id}
                          onChange={() =>
                            setForm((current) => current && { ...current, roleId: role.id })
                          }
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
                Save changes
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={resetOpen}
        title="Reset password"
        onClose={() => setResetOpen(false)}
        width="md"
      >
        <form className="users-form" onSubmit={onResetPassword} noValidate>
          {resetError ? <Alert tone="error">{resetError}</Alert> : null}
          <Input
            label="New password"
            name="new_password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint="At least 8 characters, with a letter and a number. The current password is never shown."
            required
          />
          <div className="users-form__actions">
            <Button type="button" variant="secondary" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={resetting}>
              Reset password
            </Button>
          </div>
        </form>
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
        {managedUser.name} will lose access until reactivated. Existing sessions will be rejected.
      </ConfirmDialog>
    </div>
  );
}
