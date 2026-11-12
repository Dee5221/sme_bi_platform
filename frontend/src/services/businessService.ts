import { apiRequest } from '../lib/api';

export type BusinessSettings = {
  id: number;
  name: string;
  type: string;
  contact: string;
  email: string | null;
  phone: string | null;
  address: string;
  currency: string;
  report_header: string | null;
  receipt_footer: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type UpdateBusinessPayload = {
  name?: string;
  type?: string;
  contact?: string;
  email?: string | null;
  phone?: string | null;
  address?: string;
  currency?: string;
  report_header?: string | null;
  receipt_footer?: string | null;
};

export function fetchBusiness() {
  return apiRequest<BusinessSettings>('/api/business');
}

export function updateBusiness(payload: UpdateBusinessPayload) {
  return apiRequest<BusinessSettings>('/api/business', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
