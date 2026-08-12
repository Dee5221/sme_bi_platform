import { apiRequest } from '../lib/api';

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerPayload = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  status?: 'ACTIVE' | 'INACTIVE';
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

export function listCustomers(params: {
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
  return apiRequest<Paginated<Customer>>(`/api/customers${suffix}`);
}

export function createCustomer(payload: CustomerPayload) {
  return apiRequest<{ customer: Customer }>('/api/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCustomer(id: string, payload: CustomerPayload) {
  return apiRequest<{ customer: Customer }>(`/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deactivateCustomer(id: string) {
  return apiRequest<{ customer: Customer }>(`/api/customers/${id}`, {
    method: 'DELETE',
  });
}
