import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as roleApi from '../services/roleService';
import type { ManagedRole, RolePermission } from '../services/roleService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import './RolesPermissionsPage.css';

function formatRoleName(name: string) {
  return name
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' / ');
}

function groupPermissions(permissions: RolePermission[]) {
  const groups = new Map<string, RolePermission[]>();
  for (const permission of permissions) {
    const [domain] = permission.key.split('.');
    const label = domain.replace(/_/g, ' ');
    const items = groups.get(label) || [];
    items.push(permission);
    groups.set(label, items);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function RolesPermissionsPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('roles.view');
  const canManage = hasPermission('roles.manage');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [draftKeys, setDraftKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const groupedPermissions = useMemo(() => groupPermissions(permissions), [permissions]);

  const isDirty = useMemo(() => {
    if (!selectedRole) return false;
    const current = [...selectedRole.permissionKeys].sort().join('|');
    const draft = [...draftKeys].sort().join('|');
    return current !== draft;
  }, [selectedRole, draftKeys]);

  const loadRoles = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view roles and permissions.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await roleApi.fetchRoles();
      setRoles(result.roles);
      setPermissions(result.permissions);
      setSelectedRoleId((current) => current ?? result.roles[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load roles.');
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (selectedRole) {
      setDraftKeys(selectedRole.permissionKeys);
    }
  }, [selectedRole]);

  function togglePermission(key: string) {
    if (!canManage) return;
    setDraftKeys((current) => {
      const exists = current.includes(key);
      if (exists) {
        const next = current.filter((item) => item !== key);
        return next.length === 0 ? current : next;
      }
      return [...current, key];
    });
  }

  async function onSave() {
    if (!selectedRole || !canManage) return;
    setSaving(true);
    try {
      const result = await roleApi.updateRolePermissions(selectedRole.id, draftKeys);
      setRoles((current) =>
        current.map((role) => (role.id === result.role.id ? result.role : role))
      );
      pushToast('Role permissions updated.', 'success');
    } catch (err) {
      pushToast(
        err instanceof ApiClientError ? err.message : 'Unable to update role permissions.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view roles and permissions.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={8} />
      </Card>
    );
  }

  if (error) {
    return <Alert tone="error">{error}</Alert>;
  }

  return (
    <div className="roles-page">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Review and manage permission sets for system roles in this workspace."
      />

      <div className="roles-layout">
        <Card title="System roles">
          <div className="roles-list">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`roles-list__item ${role.id === selectedRoleId ? 'is-active' : ''}`}
                onClick={() => setSelectedRoleId(role.id)}
              >
                <strong>{formatRoleName(role.name)}</strong>
                <span>{role.permissionKeys.length} permissions</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title={selectedRole ? formatRoleName(selectedRole.name) : 'Permissions'}>
          {selectedRole ? (
            <>
              <div className="roles-toolbar">
                <div className="roles-toolbar__meta">
                  {selectedRole.description || 'System role'}
                  <div>
                    <Badge tone="neutral">{selectedRole.permissionKeys.length} assigned</Badge>
                  </div>
                </div>
                {canManage ? (
                  <Button onClick={() => void onSave()} loading={saving} disabled={!isDirty}>
                    Save permissions
                  </Button>
                ) : (
                  <Badge tone="orange">View only</Badge>
                )}
              </div>

              <div className="roles-matrix">
                {groupedPermissions.map(([group, items]) => (
                  <section key={group} className="roles-group">
                    <h3 className="roles-group__title">{group}</h3>
                    {items.map((permission) => {
                      const checked = draftKeys.includes(permission.key);
                      return (
                        <label key={permission.key} className="roles-permission">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canManage}
                            onChange={() => togglePermission(permission.key)}
                          />
                          <div>
                            <strong>{permission.key}</strong>
                            {permission.description ? <span>{permission.description}</span> : null}
                          </div>
                        </label>
                      );
                    })}
                  </section>
                ))}
              </div>
            </>
          ) : (
            <Alert tone="info">Select a role to view its permissions.</Alert>
          )}
        </Card>
      </div>
    </div>
  );
}
