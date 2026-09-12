import { apiRequest } from '../lib/api';

export type DashboardData = {
  business: { id: string; name: string };
  period: { label: string; start: string; end: string };
  kpis: {
    revenue: number;
    revenueSaleCount: number;
    expenses: number;
    expenseCount: number;
    activeProducts: number;
    lowStockCount: number;
  };
  inventoryHealth: {
    trackedProducts: number;
    healthyProducts: number;
    percentHealthy: number;
  };
  lowStockItems: Array<{
    inventoryId: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    lowStockThreshold: number;
  }>;
  recentSales: Array<{
    id: string;
    saleNumber: string;
    total: number;
    soldAt: string;
    customerName: string;
    itemCount: number;
  }>;
};

export function fetchDashboard() {
  return apiRequest<{ dashboard: DashboardData }>('/api/dashboard');
}
