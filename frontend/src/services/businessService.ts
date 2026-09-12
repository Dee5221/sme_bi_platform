import { apiRequest } from '../lib/api';

export type BusinessSettings = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  usdToZmwRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpdateBusinessPayload = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  usdToZmwRate: number;
  isActive?: boolean;
};

export function fetchBusiness() {
  return apiRequest<{ business: BusinessSettings }>('/api/business');
}

export function updateBusiness(payload: UpdateBusinessPayload) {
  return apiRequest<{ business: BusinessSettings }>('/api/business', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
