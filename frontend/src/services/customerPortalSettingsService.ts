import { apiRequest } from '../lib/api';

export type CustomerPortalSettings = {
  business: {
    id: string;
    name: string;
  };
  customer: {
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

export function fetchCustomerPortalSettings() {
  return apiRequest<{ settings: CustomerPortalSettings }>('/api/portal/customer/settings');
}

export function updateCustomerPortalSettings(payload: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}) {
  return apiRequest<{ settings: CustomerPortalSettings }>('/api/portal/customer/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
