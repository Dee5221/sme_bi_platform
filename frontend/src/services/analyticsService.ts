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

export interface TopProductItem {
  product_id: number;
  product_name: string;
  sku: string;
  units_sold: number;
  revenue: number;
}

export interface ProductPerformanceItem {
  product_id: number;
  product_name: string;
  sku: string;
  units_sold: number;
  revenue: number;
  observed_days: number;
  sales_velocity: number;
  rank_units?: number | null;
  rank_velocity?: number | null;
  rank_revenue?: number | null;
}

export interface ProductPerformanceResponse {
  start: string;
  end: string;
  observed_days: number;
  note: string;
  products: ProductPerformanceItem[];
  top_by_units: ProductPerformanceItem[];
  top_by_velocity: ProductPerformanceItem[];
  top_by_revenue: ProductPerformanceItem[];
}

export interface ProfitabilityProductItem {
  product_id: number;
  product_name: string;
  sku: string;
  units_sold: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number | null;
  classification: string;
}

export interface ProfitabilityResponse {
  available: boolean;
  reason: string | null;
  start: string;
  end: string;
  line_count: number;
  costed_line_count: number;
  coverage_pct: number;
  revenue_all: number;
  revenue_costed: number;
  cogs: number;
  gross_profit: number | null;
  gross_margin_pct: number | null;
  products: ProfitabilityProductItem[];
  top_by_gross_profit: ProfitabilityProductItem[];
  top_by_margin: ProfitabilityProductItem[];
  high_volume_low_margin: ProfitabilityProductItem[];
  low_volume_high_margin: ProfitabilityProductItem[];
  negative_margin: ProfitabilityProductItem[];
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

export function fetchTopProducts(
  params?: DateRangeParams & { limit?: number; sort_by?: 'revenue' | 'units' }
): Promise<TopProductItem[]> {
  const query = new URLSearchParams();
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.sort_by) query.set('sort_by', params.sort_by);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<TopProductItem[]>(`/api/analytics/top-products${suffix}`);
}

export function fetchProductPerformance(
  params?: DateRangeParams & { period?: 7 | 30 | 90; limit?: number }
): Promise<ProductPerformanceResponse> {
  const query = new URLSearchParams();
  if (params?.period) query.set('period', String(params.period));
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<ProductPerformanceResponse>(`/api/analytics/product-performance${suffix}`);
}

export function fetchProfitability(
  params?: DateRangeParams & { period?: 7 | 30 | 90; limit?: number }
): Promise<ProfitabilityResponse> {
  const query = new URLSearchParams();
  if (params?.period) query.set('period', String(params.period));
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<ProfitabilityResponse>(`/api/analytics/profitability${suffix}`);
}