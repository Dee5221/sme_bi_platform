import { apiRequest } from '../lib/api';

export type RolePermission = {
  key: string;
  group: string;
  description: string;
};

export type ManagedRole = {
  id: number | null;
  role_name: string;
  display_name: string;
  description: string;
  assignable: boolean;
  permission_keys: string[];
  member_count: number;
};

export type RoleMember = {
  id: number;
  name: string;
  email: string;
  status: string;
  role_id: number;
  role_name: string;
  display_name: string;
  assignable: boolean;
};

export type RolesMatrix = {
  roles: ManagedRole[];
  permissions: RolePermission[];
  members: RoleMember[];
  locked: boolean;
  note: string;
};

export function fetchRoles() {
  return apiRequest<RolesMatrix>('/api/roles/');
}
