import { apiRequest } from '../lib/api';

export type Customer = {
  id: number;
  business_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  type: string | null;
};

export type CustomerPayload = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  type?: string;
};

// Backend returns a flat array, no server-side pagination or search
export function listCustomers(): Promise<Customer[]> {
  return apiRequest<Customer[]>('/api/customers/');
}

export function createCustomer(payload: CustomerPayload): Promise<Customer> {
  return apiRequest<Customer>('/api/customers/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCustomer(id: number, payload: CustomerPayload): Promise<Customer> {
  return apiRequest<Customer>(`/api/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}