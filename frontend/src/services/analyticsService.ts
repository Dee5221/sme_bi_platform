import { apiRequest } from '../lib/api';

export type BusinessAnalyticsData = {
  period: { label: string; months: number; start: string; end: string };
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netResult: number;
    totalSales: number;
    activeCustomers: number;
    activeProducts: number;
    lowStockCount: number;
  };
  monthlyTrend: Array<{
    key: string;
    label: string;
    revenue: number;
    expenses: number;
    net: number;
    salesCount: number;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    productSku: string;
    revenue: number;
    quantity: number;
  }>;
  expensesByCategory: Array<{
    categoryName: string;
    amount: number;
  }>;
};

export function fetchBusinessAnalytics(months = 6) {
  return apiRequest<{ analytics: BusinessAnalyticsData }>(
    `/api/analytics/business?months=${months}`
  );
}
