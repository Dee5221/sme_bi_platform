import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as roleApi from '../services/roleService';
import type { ManagedRole, RoleMember, RolePermission } from '../services/roleService';
import * as userApi from '../services/userService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import './RolesPermissionsPage.css';

function groupPermissions(permissions: RolePermission[]) {
  const groups = new Map<string, RolePermission[]>();
  for (const permission of permissions) {
    const items = groups.get(permission.group) || [];
    items.push(permission);
    groups.set(permission.group, items);
  }
  return Array.from(groups.entries());
}

export function RolesPermissionsPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('roles.view');
  const canAssign = hasPermission('users.manage');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [members, setMembers] = useState<RoleMember[]>([]);
  const [selectedRoleName, setSelectedRoleName] = useState<string | null>(null);
  const [draftRoleIds, setDraftRoleIds] = useState<Record<number, number>>({});
  const [pending, setPending] = useState<RoleMember | null>(null);
  const [assigning, setAssigning] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((role) => role.role_name === selectedRoleName) ?? null,
    [roles, selectedRoleName]
  );

  const groupedPermissions = useMemo(() => groupPermissions(permissions), [permissions]);
  const assignableRoles = useMemo(() => roles.filter((role) => role.assignable), [roles]);

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
      setMembers(result.members);
      setSelectedRoleName((current) => current ?? result.roles[0]?.role_name ?? null);
      const nextDraft: Record<number, number> = {};
      for (const member of result.members) {
        nextDraft[member.id] = member.role_id;
      }
      setDraftRoleIds(nextDraft);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load roles.');
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  function requestedRoleId(member: RoleMember) {
    return draftRoleIds[member.id] ?? member.role_id;
  }

  async function onConfirmAssign() {
    if (!pending) return;
    const roleId = requestedRoleId(pending);
    setAssigning(true);
    try {
      await userApi.updateUser(pending.id, { role_id: roleId });
      pushToast('Role updated.', 'success');
      setPending(null);
      setLoading(true);
      await loadRoles();
    } catch (err) {
      pushToast(err instanceof ApiClientError ? err.message : 'Unable to change role.', 'error');
    } finally {
      setAssigning(false);
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

  const pendingRole = pending
    ? assignableRoles.find((role) => role.id === requestedRoleId(pending))
    : null;

  return (
    <div className="roles-page">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Review what each role can do."
      />

      <div className="roles-layout">
        <Card title="System roles">
          <div className="roles-list">
            {roles.map((role) => (
              <button
                key={role.role_name}
                type="button"
                className={`roles-list__item ${role.role_name === selectedRoleName ? 'is-active' : ''}`}
                onClick={() => setSelectedRoleName(role.role_name)}
              >
                <strong>{role.display_name}</strong>
                <span>
                  {role.permission_keys.length} permissions · {role.member_count}{' '}
                  {role.member_count === 1 ? 'account' : 'accounts'}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card title={selectedRole ? selectedRole.display_name : 'Permissions'}>
          {selectedRole ? (
            <>
              <div className="roles-toolbar">
                <div className="roles-toolbar__meta">{selectedRole.description}</div>
                <Badge tone="orange">Fixed in application</Badge>
              </div>
              <div className="roles-matrix">
                {groupedPermissions.map(([group, items]) => (
                  <section key={group} className="roles-group">
                    <h3 className="roles-group__title">{group}</h3>
                    {items.map((permission) => {
                      const granted = selectedRole.permission_keys.includes(permission.key);
                      return (
                        <div key={permission.key} className="roles-permission">
                          <Badge tone={granted ? 'green' : 'neutral'}>
                            {granted ? 'Granted' : 'Not granted'}
                          </Badge>
                          <div>
                            <strong>{permission.key}</strong>
                            {permission.description ? <span>{permission.description}</span> : null}
                          </div>
                        </div>
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

      <Card title="Permission matrix">
        <div className="roles-compare-wrap">
          <table className="roles-compare">
            <thead>
              <tr>
                <th>Permission</th>
                {roles.map((role) => (
                  <th key={role.role_name}>{role.display_name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission.key}>
                  <td>
                    <strong>{permission.key}</strong>
                    <div className="roles-compare__hint">{permission.description}</div>
                  </td>
                  {roles.map((role) => {
                    const granted = role.permission_keys.includes(permission.key);
                    return (
                      <td key={`${role.role_name}-${permission.key}`} className="roles-compare__cell">
                        {granted ? 'Yes' : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Assign roles to employees">
        {canAssign ? (
          <>
            <p className="roles-toolbar__meta">
              Manager and Sales Staff can be assigned here. The last active Business Owner cannot
              be demoted.{' '}
              <Link to="/app/users">Open user accounts</Link>
            </p>
            <div className="roles-compare-wrap">
              <table className="roles-compare">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Current role</th>
                    <th>Assign</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const isSelf = member.id === currentUser?.id;
                    const locked = !member.assignable || isSelf;
                    return (
                      <tr key={member.id}>
                        <td>
                          <strong>{member.name}</strong>
                          <div className="roles-compare__hint">{member.email}</div>
                        </td>
                        <td>
                          <Badge tone="neutral">{member.display_name}</Badge>
                        </td>
                        <td>
                          {locked ? (
                            <span className="roles-compare__hint">
                              {isSelf
                                ? 'Your own role cannot be changed here.'
                                : 'Business Owner cannot be assigned or demoted here.'}
                            </span>
                          ) : (
                            <div className="roles-assign">
                              <select
                                value={requestedRoleId(member)}
                                onChange={(event) =>
                                  setDraftRoleIds((current) => ({
                                    ...current,
                                    [member.id]: Number(event.target.value),
                                  }))
                                }
                              >
                                {assignableRoles.map((role) =>
                                  role.id != null ? (
                                    <option key={role.id} value={role.id}>
                                      {role.display_name}
                                    </option>
                                  ) : null
                                )}
                              </select>
                              <Button
                                variant="secondary"
                                disabled={requestedRoleId(member) === member.role_id}
                                onClick={() => setPending(member)}
                              >
                                Apply
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Alert tone="info">You can review roles but cannot assign them to employees.</Alert>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pending)}
        title="Change role?"
        confirmLabel="Assign role"
        loading={assigning}
        onCancel={() => setPending(null)}
        onConfirm={() => void onConfirmAssign()}
      >
        {pending && pendingRole
          ? `${pending.name} will be assigned ${pendingRole.display_name}. This change is recorded in the activity log.`
          : null}
      </ConfirmDialog>
    </div>
  );
}
