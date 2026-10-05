import { apiRequest } from '../lib/api';

// ============================================================================
// Types — Match backend contract exactly
// ============================================================================

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
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: {
    id: number;
    name: string;
    sku: string;
  } | null;
}

export interface Sale {
  id: number;
  business_id: number;
  user_id: number;
  customer_id?: number | null;
  sale_datetime: string;
  total_amount: number;
  payment_method: string;
  status: string;
  items: SaleItem[];
  customer?: {
    id: number;
    name: string;
  } | null;
  user?: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export interface ListSalesParams {
  start_date?: string;
  end_date?: string;
  status_filter?: string;
  user_id?: number;
}

// ============================================================================
// API calls — Backend returns flat Sale[] array, NOT paginated
// ============================================================================

export function createSale(payload: CreateSalePayload): Promise<Sale> {
  return apiRequest<Sale>('/api/sales/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listSales(params?: ListSalesParams): Promise<Sale[]> {
  const query = new URLSearchParams();
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  if (params?.status_filter) query.set('status_filter', params.status_filter);
  if (params?.user_id) query.set('user_id', String(params.user_id));

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<Sale[]>(`/api/sales/${suffix}`);
}

export function getSale(id: number): Promise<Sale> {
  return apiRequest<Sale>(`/api/sales/${id}`);
}