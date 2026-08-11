import { apiRequest } from '../lib/api';

export type Supplier = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type SupplierPayload = {
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

export function listSuppliers(params: {
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
  return apiRequest<Paginated<Supplier>>(`/api/suppliers${suffix}`);
}

export function createSupplier(payload: SupplierPayload) {
  return apiRequest<{ supplier: Supplier }>('/api/suppliers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSupplier(id: string, payload: SupplierPayload) {
  return apiRequest<{ supplier: Supplier }>(`/api/suppliers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deactivateSupplier(id: string) {
  return apiRequest<{ supplier: Supplier }>(`/api/suppliers/${id}`, {
    method: 'DELETE',
  });
}
