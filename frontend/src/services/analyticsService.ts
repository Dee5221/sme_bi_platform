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

export type InventoryAnalyticsData = {
  period: { label: string; months: number; start: string; end: string };
  summary: {
    trackedProducts: number;
    totalUnitsOnHand: number;
    inventoryValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    healthyStockCount: number;
    percentHealthy: number;
    periodStockIn: number;
    periodStockOut: number;
    netMovement: number;
  };
  monthlyTrend: Array<{
    key: string;
    label: string;
    stockIn: number;
    stockOut: number;
    netMovement: number;
    stockInMovements: number;
    stockOutMovements: number;
  }>;
  lowStockProducts: Array<{
    inventoryId: string;
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    lowStockThreshold: number;
  }>;
  topStockInProducts: Array<{
    productId: string;
    productName: string;
    productSku: string;
    units: number;
    movements: number;
  }>;
  topStockOutProducts: Array<{
    productId: string;
    productName: string;
    productSku: string;
    units: number;
    movements: number;
  }>;
  movementBreakdown: {
    stockInMovements: number;
    stockOutMovements: number;
    stockInUnits: number;
    stockOutUnits: number;
  };
};

export function fetchInventoryAnalytics(months = 6) {
  return apiRequest<{ analytics: InventoryAnalyticsData }>(
    `/api/analytics/inventory?months=${months}`
  );
}

export type CustomerAnalyticsData = {
  period: { label: string; months: number; start: string; end: string };
  summary: {
    activeCustomers: number;
    newCustomersInPeriod: number;
    customersWithSalesInPeriod: number;
    customerLinkedSales: number;
    walkInSales: number;
    customerRevenue: number;
    walkInRevenue: number;
    repeatCustomersInPeriod: number;
    oneTimeCustomersInPeriod: number;
    averageRevenuePerCustomer: number;
  };
  monthlyTrend: Array<{
    key: string;
    label: string;
    newCustomers: number;
    customerSales: number;
    customerRevenue: number;
  }>;
  topCustomersByRevenue: Array<{
    customerId: string;
    customerName: string;
    salesCount: number;
    revenue: number;
  }>;
  topCustomersBySalesCount: Array<{
    customerId: string;
    customerName: string;
    salesCount: number;
    revenue: number;
  }>;
  walkInSummary: {
    salesCount: number;
    revenue: number;
  };
  customerMix: {
    repeatCustomers: number;
    oneTimeCustomers: number;
    walkInSales: number;
  };
};

export function fetchCustomerAnalytics(months = 6) {
  return apiRequest<{ analytics: CustomerAnalyticsData }>(
    `/api/analytics/customers?months=${months}`
  );
}
