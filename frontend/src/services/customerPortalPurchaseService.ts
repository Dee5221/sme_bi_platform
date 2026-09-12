import { apiRequest } from '../lib/api';

export type CustomerPurchase = {
  id: string;
  saleNumber: string;
  status: string;
  subtotal: number;
  total: number;
  notes: string | null;
  soldAt: string;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
};

export type CustomerPurchaseListResult = {
  items: CustomerPurchase[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function listCustomerPurchases(params?: {
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<CustomerPurchaseListResult>(`/api/portal/customer/purchases${suffix}`);
}

export function getCustomerPurchase(id: string) {
  return apiRequest<{ purchase: CustomerPurchase }>(`/api/portal/customer/purchases/${id}`);
}
