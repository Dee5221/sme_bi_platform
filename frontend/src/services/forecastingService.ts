import { apiRequest } from '../lib/api';
import type { ProductPerformanceItem, ProfitabilityResponse } from './analyticsService';

export type ForecastMethodCandidate = {
  method: string;
  label: string;
  eligible: boolean;
  mae: number | null;
  rmse: number | null;
  origins: number;
  note: string | null;
};

export type ForecastEvaluation = {
  train_periods: number;
  test_periods: number;
  window: number;
  mae: number | null;
  rmse: number | null;
  mase: number | null;
  naive_mae: number | null;
  beats_baseline: boolean;
  mase_note?: string | null;
  selected_method?: string | null;
  selected_label?: string | null;
  fallback?: boolean;
  candidates?: ForecastMethodCandidate[];
};

export type InventoryForecastItem = {
  productId: number | string;
  productName: string;
  productSku: string;
  currentQuantity: number;
  lowStockThreshold: number;
  averageMonthlyDemand: number;
  projectedDemandNextMonth: number;
  estimatedDaysUntilStockout: number | null;
  suggestedRestockQuantity: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  forecastDailyDemand?: number | null;
  horizonDemand?: number | null;
  demandHorizonDays?: number | null;
  selectedMethod?: string | null;
  selectedMethodLabel?: string | null;
  reorderReliable?: boolean;
  reorderNote?: string | null;
  safetyStock?: number | null;
  forecastPath?: number[];
  openDaysUsed?: number | null;
  dataSufficient?: boolean;
  evaluationMae?: number | null;
  expectedRevenue?: number | null;
  fallback?: boolean;
};

export type ForecastInsightNote = {
  productName: string | null;
  period: string;
  metric: string;
  reason: string;
  suggestedAction: string;
  dataSufficient: boolean;
};

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
  inventoryForecasts: InventoryForecastItem[];
  dataQuality: {
    monthsWithSales: number;
    monthsWithExpenses: number;
    hasEnoughHistory: boolean;
  };
  evaluation?: ForecastEvaluation;
  demandHorizonDays?: number;
  productPerformance?: ProductPerformanceItem[];
  profitability?: ProfitabilityResponse | null;
  insights?: ForecastInsightNote[];
};

export function fetchForecasting(months = 6, horizon = 3, demandHorizon = 7) {
  return apiRequest<ForecastingData | { forecasting: ForecastingData }>(
    `/api/forecasting?months=${months}&horizon=${horizon}&demand_horizon=${demandHorizon}`
  ).then((data) => {
    if (data && typeof data === 'object' && 'forecasting' in data && data.forecasting) {
      return { forecasting: data.forecasting };
    }
    return { forecasting: data as ForecastingData };
  });
}
