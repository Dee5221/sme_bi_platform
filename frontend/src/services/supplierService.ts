import { apiRequest } from '../lib/api';

export type Supplier = {
  id: number;
  business_id: number;
  name: string;
  contact: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string; // 'active' or 'inactive'
};

export type SupplierPayload = {
  name: string;
  contact: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: string;
};

// Backend returns a flat array, no server-side pagination or search
export function listSuppliers(): Promise<Supplier[]> {
  return apiRequest<Supplier[]>('/api/suppliers/');
}

export function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  return apiRequest<Supplier>('/api/suppliers/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSupplier(id: number, payload: SupplierPayload): Promise<Supplier> {
  return apiRequest<Supplier>(`/api/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}