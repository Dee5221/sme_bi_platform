import { apiRequest } from '../lib/api';

export type Customer = {
  id: number;
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

export function listCustomers(params: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return apiRequest<Customer[]>('/api/customers/').then((customers) => {
    const search = params.search?.trim().toLowerCase();
    const filtered = search
      ? customers.filter((customer) =>
          [customer.name, customer.email, customer.phone]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(search))
        )
      : customers;
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize) || 1,
      },
    };
  });
}

export function createCustomer(payload: CustomerPayload) {
  return apiRequest<{ customer: Customer }>('/api/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCustomer(id: number, payload: CustomerPayload) {
  return apiRequest<{ customer: Customer }>(`/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deactivateCustomer(id: number) {
  return apiRequest<{ customer: Customer }>(`/api/customers/${id}`, {
    method: 'DELETE',
  });
}
