import { apiRequest } from '../lib/api';

export type SupplierPortalSettings = {
  business: {
    id: string;
    name: string;
  };
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
};

export function fetchSupplierPortalSettings() {
  return apiRequest<{ settings: SupplierPortalSettings }>('/api/portal/supplier/settings');
}

export function updateSupplierPortalSettings(payload: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}) {
  return apiRequest<{ settings: SupplierPortalSettings }>('/api/portal/supplier/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
