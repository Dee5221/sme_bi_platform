import { apiRequest } from '../lib/api';

export type ForecastingData = {
  methodology: {
    label: string;
    description: string;
    lookbackMonths: number;
    forecastMonths: number;
  };
  lookback: { label: string; start: string; end: string };
  forecastPeriod: { label: string; start: string; end: string };
  historicalMonthly: Array<{
    key: string;
    label: string;
    revenue: number;
    expenses: number;
    netResult: number;
    salesCount: number;
  }>;
  forecastMonthly: Array<{
    key: string;
    label: string;
    revenue: number;
    expenses: number;
    netResult: number;
    salesCount: number;
  }>;
  summary: {
    historicalAvgRevenue: number;
    historicalAvgExpenses: number;
    historicalAvgSalesCount: number;
    historicalAvgNet: number;
    projectedRevenueTotal: number;
    projectedExpensesTotal: number;
    projectedNetTotal: number;
    projectedSalesTotal: number;
  };
  inventoryForecasts: Array<{
    productId: string;
    productName: string;
    productSku: string;
    currentQuantity: number;
    lowStockThreshold: number;
    averageMonthlyDemand: number;
    projectedDemandNextMonth: number;
    estimatedDaysUntilStockout: number | null;
    suggestedRestockQuantity: number;
    urgency: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  }>;
  dataQuality: {
    monthsWithSales: number;
    monthsWithExpenses: number;
    hasEnoughHistory: boolean;
  };
};

export function fetchForecasting(months = 6, horizon = 3) {
  return apiRequest<{ forecasting: ForecastingData }>(
    `/api/forecasting?months=${months}&horizon=${horizon}`
  );
}
