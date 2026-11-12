import { apiRequest } from '../lib/api';

// =============================================================================
// Type Definitions (matching backend schemas/recommendations.py)
// =============================================================================

export type RecommendationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type RecommendationCategory = 'inventory' | 'sales' | 'expenses' | 'profitability';

export interface AffectedEntity {
  type: string;
  id: number | null;
  name: string | null;
  sku?: string | null;
}

export interface DataQuality {
  months_of_history: number | null;
  has_sufficient_data: boolean;
  limitations: string;
}

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  type: string;
  severity: RecommendationSeverity;
  title: string;
  explanation: string;
  suggested_action: string;
  priority: number;
  affected_entity: AffectedEntity;
  metrics: Record<string, number | string | boolean | null>;
  data_quality: DataQuality;
  period?: string | null;
  reason?: string | null;
  audience?: 'operational' | 'strategic' | string | null;
}

export interface AnalysisPeriod {
  start: string;
  end: string;
  months: number;
}

export interface RecommendationSummary {
  by_severity: Record<RecommendationSeverity, number>;
  by_category: Record<string, number>;
}

export interface RecommendationsResponse {
  generated_at: string;
  analysis_period: AnalysisPeriod;
  total_recommendations: number;
  recommendations: Recommendation[];
  summary: RecommendationSummary;
  limitations: string[];
}

export interface RecommendationFilters {
  categories?: string;
  severity?: string;
  months?: number;
}

// =============================================================================
// API Service
// =============================================================================

export function fetchRecommendations(
  filters?: RecommendationFilters
): Promise<RecommendationsResponse> {
  const params = new URLSearchParams();

  if (filters?.categories) {
    params.set('categories', filters.categories);
  }
  if (filters?.severity) {
    params.set('severity', filters.severity);
  }
  if (filters?.months) {
    params.set('months', filters.months.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString
    ? `/api/recommendations?${queryString}`
    : '/api/recommendations';

  return apiRequest<RecommendationsResponse>(endpoint);
}