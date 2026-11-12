import { apiRequest } from '../lib/api';

export type UserRole = {
  id: number;
  role_name: string;
};

export type ManagedUser = {
  id: number;
  name: string;
  email: string;
  status: string;
  business_id: number;
  role: UserRole;
  created_at: string | null;
  updated_at: string | null;
};

export type UserActivityEntry = {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  result: string;
  created_at: string;
  actor_name: string;
  actor_email: string | null;
};

export type UserDetails = {
  user: ManagedUser;
  recent_activity: UserActivityEntry[];
};

export type AssignableRole = {
  id: number;
  role_name: string;
  description: string | null;
};

export type UserCreatePayload = {
  name: string;
  email: string;
  password: string;
  role_id: number;
};

export type UserUpdatePayload = {
  name?: string;
  email?: string;
  role_id?: number;
  status?: string;
};

type Paginated<T> = {
  items: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

export function listAssignableRoles() {
  return apiRequest<AssignableRole[]>('/api/users/roles');
}

export function fetchUser(id: number | string) {
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
  if (params.pageSize) query.set('page_size', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<Paginated<ManagedUser>>(`/api/users/${suffix}`);
}

export function createUser(payload: UserCreatePayload) {
  return apiRequest<ManagedUser>('/api/users/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUser(id: number | string, payload: UserUpdatePayload) {
  return apiRequest<ManagedUser>(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deactivateUser(id: number | string) {
  return apiRequest<ManagedUser>(`/api/users/${id}`, {
    method: 'DELETE',
  });
}

export function resetUserPassword(id: number | string, newPassword: string) {
  return apiRequest<{ message: string }>(`/api/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
  });
}
