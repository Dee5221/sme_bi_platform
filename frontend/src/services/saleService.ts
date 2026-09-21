import { apiRequest } from '../lib/api';

export type SaleItem = {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type Sale = {
  id: number;
  business_id: number;
  user_id: number;
  user_name: string;
  customer_id: number | null;
  customer_name: string | null;
  sale_datetime: string;
  total_amount: number;
  payment_method: string;
  status: string;
  items: SaleItem[];
};

export type SaleList = {
  id: number;
  sale_datetime: string;
  total_amount: number;
  payment_method: string;
  status: string;
  user_name: string;
  customer_name: string | null;
  item_count: number;
};

export type CreateSalePayload = {
  customer_id?: number;
  payment_method: string;
  items: { product_id: number; quantity: number }[];
};

export function listSales(params: {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.from) query.set('start_date', params.from);
  if (params.to) query.set('end_date', params.to);
  
  // Ensure page and pageSize are always sent if your backend expects them for consistency
  query.set('page', String(params.page || 1));
  query.set('pageSize', String(params.pageSize || 20));
  
  const suffix = query.toString() ? `?${query.toString()}` : '';
  
  return apiRequest<SaleList[]>(`/api/sales/${suffix}`).then((data) => {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    return {
      items: data,
      pagination: {
        page,
        pageSize,
        total: data.length,
        totalPages: Math.ceil(data.length / pageSize) || 1,
      },
    };
  });
}

export function getSale(id: number) {
  return apiRequest<Sale>(`/api/sales/${id}`);
}

export function createSale(payload: CreateSalePayload) {
  return apiRequest<Sale>('/api/sales/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}