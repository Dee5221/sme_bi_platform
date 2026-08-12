import { apiRequest } from '../lib/api';

export type SupplierPortalDashboardData = {
  business: { id: string; name: string };
  supplier: { id: string; name: string; email: string | null };
  period: {
    label: string;
    monthStart: string;
    monthEnd: string;
  };
  kpis: {
    lifetimeSupplyRecords: number;
    lifetimeUnitsSupplied: number;
    monthSupplyRecords: number;
    monthUnitsSupplied: number;
    productsSupplied: number;
    averageUnitsPerRecord: number;
  };
  recentSupplyRecords: Array<{
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    reason: string | null;
    createdAt: string;
  }>;
};

export function fetchSupplierPortalDashboard() {
  return apiRequest<{ dashboard: SupplierPortalDashboardData }>(
    '/api/portal/supplier/dashboard'
  );
}
