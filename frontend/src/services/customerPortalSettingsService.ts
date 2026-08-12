import { apiRequest } from '../lib/api';
import type { PricingCurrency } from '../lib/money';

export type CustomerPortalSettings = {
  business: {
    id: string;
    name: string;
    usdToZmwRate: number;
  };
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    preferredCurrency: PricingCurrency;
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

export function updateCustomerPortalCurrency(preferredCurrency: PricingCurrency) {
  return apiRequest<{ settings: CustomerPortalSettings }>('/api/portal/customer/currency', {
    method: 'PUT',
    body: JSON.stringify({ preferredCurrency }),
  });
}
