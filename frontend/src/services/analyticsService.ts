import { apiRequest } from '../lib/api';

// =============================================================================
// Response Types (matching backend schemas)
// =============================================================================

export interface SummaryResponse {
  total_revenue: number;
  total_expenses: number;
  net_cash_flow: number;
  total_transactions: number;
  aov: number;
  low_stock_count: number;
  period_start: string;
  period_end: string;
}

export interface SalesTrendPoint {
  period: string;
  revenue: number;
  transactions: number;
}

export interface SalesByCategoryItem {
  category_name: string;
  revenue: number;
  units_sold: number;
}

export interface InventoryHealthResponse {
  total_items: number;
  low_stock_items: number;
  total_inventory_value: number | null;
  note: string | null;
}

// =============================================================================
// API Calls
// =============================================================================

export interface DateRangeParams {
  start_date?: string;
  end_date?: string;
}

export function fetchSummary(params?: DateRangeParams): Promise<SummaryResponse> {
  const query = new URLSearchParams();
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<SummaryResponse>(`/api/analytics/summary${suffix}`);
}

export function fetchSalesTrend(
  params?: DateRangeParams & { group_by?: 'day' | 'month' }
): Promise<SalesTrendPoint[]> {
  const query = new URLSearchParams();
  if (params?.group_by) query.set('group_by', params.group_by);
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<SalesTrendPoint[]>(`/api/analytics/sales/trend${suffix}`);
}

export function fetchSalesByCategory(
  params?: DateRangeParams
): Promise<SalesByCategoryItem[]> {
  const query = new URLSearchParams();
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<SalesByCategoryItem[]>(`/api/analytics/sales/by-category${suffix}`);
}

export function fetchInventoryHealth(): Promise<InventoryHealthResponse> {
  return apiRequest<InventoryHealthResponse>('/api/analytics/inventory/health');
}