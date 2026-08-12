import { apiRequest } from '../lib/api';

export type ManagedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: string[];
  roleIds: string[];
};

export type UserActivityEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  actorName: string;
  actorEmail: string | null;
};

export type UserDetails = {
  user: ManagedUser;
  recentActivity: UserActivityEntry[];
};

export type AssignableRole = {
  id: string;
  name: string;
  description: string | null;
};

export type UserPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password?: string;
  roleIds: string[];
  isActive?: boolean;
};

type Paginated<T> = {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function listAssignableRoles() {
  return apiRequest<{ roles: AssignableRole[] }>('/api/users/roles');
}

export function fetchUser(id: string) {
  return apiRequest<UserDetails>(`/api/users/${id}`);
}

export function listUsers(params: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<Paginated<ManagedUser>>(`/api/users${suffix}`);
}

export function createUser(payload: UserPayload) {
  return apiRequest<{ user: ManagedUser }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUser(id: string, payload: UserPayload) {
  return apiRequest<{ user: ManagedUser }>(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deactivateUser(id: string) {
  return apiRequest<{ user: ManagedUser }>(`/api/users/${id}`, {
    method: 'DELETE',
  });
}
