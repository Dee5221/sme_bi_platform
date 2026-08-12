import { apiRequest } from '../lib/api';

export type RolePermission = {
  id: string;
  key: string;
  description: string | null;
};

export type ManagedRole = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: string[];
  permissions: RolePermission[];
};

export type RolesData = {
  roles: ManagedRole[];
  permissions: RolePermission[];
};

export function fetchRoles() {
  return apiRequest<RolesData>('/api/roles');
}

export function updateRolePermissions(roleId: string, permissionKeys: string[]) {
  return apiRequest<{ role: ManagedRole }>(`/api/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissionKeys }),
  });
}
