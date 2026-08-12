import { apiRequest } from '../lib/api';

export type StaffDashboardData = {
  business: { id: string; name: string };
  period: {
    label: string;
    todayStart: string;
    todayEnd: string;
    monthStart: string;
    monthEnd: string;
  };
  kpis: {
    todayRevenue: number;
    todaySaleCount: number;
    monthRevenue: number;
    monthSaleCount: number;
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

export function fetchStaffDashboard() {
  return apiRequest<{ dashboard: StaffDashboardData }>('/api/staff/dashboard');
}
