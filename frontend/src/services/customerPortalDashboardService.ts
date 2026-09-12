import { apiRequest } from '../lib/api';

export type CustomerPortalDashboardData = {
  business: { id: string; name: string };
  customer: { id: string; name: string; email: string | null };
  period: {
    label: string;
    monthStart: string;
    monthEnd: string;
  };
  kpis: {
    lifetimeSpent: number;
    lifetimePurchaseCount: number;
    monthSpent: number;
    monthPurchaseCount: number;
    averageOrderValue: number;
  };
  recentPurchases: Array<{
    id: string;
    saleNumber: string;
    total: number;
    soldAt: string;
    itemCount: number;
    items: Array<{ productName: string; quantity: number }>;
  }>;
};

export function fetchCustomerPortalDashboard() {
  return apiRequest<{ dashboard: CustomerPortalDashboardData }>(
    '/api/portal/customer/dashboard'
  );
}
