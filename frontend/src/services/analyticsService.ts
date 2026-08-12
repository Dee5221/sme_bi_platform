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

export type SalesAnalyticsData = {
  period: { label: string; months: number; start: string; end: string };
  summary: {
    totalRevenue: number;
    totalSales: number;
    averageOrderValue: number;
    totalUnitsSold: number;
    walkInSales: number;
    customerLinkedSales: number;
    walkInRevenue: number;
    customerRevenue: number;
  };
  monthlyTrend: Array<{
    key: string;
    label: string;
    revenue: number;
    salesCount: number;
    averageOrderValue: number;
    unitsSold: number;
  }>;
  topProductsByRevenue: Array<{
    productId: string;
    productName: string;
    productSku: string;
    revenue: number;
    quantity: number;
  }>;
  topProductsByQuantity: Array<{
    productId: string;
    productName: string;
    productSku: string;
    revenue: number;
    quantity: number;
  }>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    salesCount: number;
    revenue: number;
  }>;
  walkInSummary: {
    salesCount: number;
    revenue: number;
  };
};

export function fetchSalesAnalytics(months = 6) {
  return apiRequest<{ analytics: SalesAnalyticsData }>(`/api/analytics/sales?months=${months}`);
}
