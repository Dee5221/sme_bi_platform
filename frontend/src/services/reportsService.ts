import { apiRequest } from '../lib/api';

export type ReportData = {
  business: { id: string; name: string };
  period: { start: string; end: string; label: string };
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netResult: number;
    salesCount: number;
    expenseCount: number;
    averageOrderValue: number;
    trackedProducts: number;
    totalUnitsOnHand: number;
    inventoryValue: number;
    lowStockCount: number;
  };
  sales: {
    rows: Array<{
      id: string;
      saleNumber: string;
      soldAt: string;
      customerName: string;
      itemCount: number;
      total: number;
    }>;
    totalAmount: number;
    count: number;
  };
  expenses: {
    rows: Array<{
      id: string;
      title: string;
      expenseDate: string;
      categoryName: string;
      amount: number;
    }>;
    totalAmount: number;
    count: number;
    byCategory: Array<{ categoryName: string; amount: number }>;
  };
  inventory: {
    rows: Array<{
      productId: string;
      productName: string;
      sku: string;
      quantity: number;
      lowStockThreshold: number;
      unitPrice: number;
      inventoryValue: number;
      isLowStock: boolean;
    }>;
    totalUnits: number;
    totalValue: number;
    lowStockCount: number;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    revenue: number;
  }>;
};

export function fetchReport(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const query = params.toString();
  return apiRequest<{ report: ReportData }>(`/api/reports${query ? `?${query}` : ''}`);
}
