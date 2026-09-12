import { apiRequest } from '../lib/api';

export type SaleItem = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type Sale = {
  id: string;
  saleNumber: string;
  status: string;
  subtotal: number;
  total: number;
  notes: string | null;
  soldAt: string;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  items: SaleItem[];
};

export type CreateSalePayload = {
  customerId?: string;
  notes?: string;
  items: { productId: string; quantity: number }[];
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

export function listSales(params: {
  search?: string;
  customerId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.customerId) query.set('customerId', params.customerId);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<Paginated<Sale>>(`/api/sales${suffix}`);
}

export function getSale(id: string) {
  return apiRequest<{ sale: Sale }>(`/api/sales/${id}`);
}

export function createSale(payload: CreateSalePayload) {
  return apiRequest<{ sale: Sale }>('/api/sales', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
