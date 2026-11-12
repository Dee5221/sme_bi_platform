import { apiRequest } from '../lib/api';

export interface SaleItemPayload {
  product_id: number;
  quantity: number;
}

export interface CreateSalePayload {
  customer_id?: number;
  payment_method: string;
  items: SaleItemPayload[];
}

export interface SaleItem {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  unit_cost?: number | null;
}

export interface SaleListItem {
  id: number;
  sale_datetime: string;
  total_amount: number;
  payment_method: string;
  status: string;
  user_name: string;
  customer_name: string | null;
  item_count: number;
}

export interface SaleDetail {
  id: number;
  business_id: number;
  user_id: number;
  user_name: string;
  customer_id?: number | null;
  customer_name: string | null;
  sale_datetime: string;
  total_amount: number;
  payment_method: string;
  status: string;
  items: SaleItem[];
}

export type Sale = SaleListItem & Partial<SaleDetail>;

export interface ListSalesParams {
  start_date?: string;
  end_date?: string;
  status_filter?: string;
  user_id?: number;
}

export function createSale(payload: CreateSalePayload, idempotencyKey?: string): Promise<SaleDetail> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  return apiRequest<SaleDetail>('/api/sales/', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

export function listSales(params?: ListSalesParams): Promise<SaleListItem[]> {
  const query = new URLSearchParams();
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  if (params?.status_filter) query.set('status_filter', params.status_filter);
  if (params?.user_id) query.set('user_id', String(params.user_id));

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<SaleListItem[]>(`/api/sales/${suffix}`);
}

export function getSale(id: number): Promise<SaleDetail> {
  return apiRequest<SaleDetail>(`/api/sales/${id}`);
}
