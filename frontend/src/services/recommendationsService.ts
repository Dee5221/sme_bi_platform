import { apiRequest } from '../lib/api';

export type RecommendationItem = {
  id: string;
  category: 'INVENTORY' | 'SALES' | 'EXPENSES' | 'CUSTOMERS' | 'BUSINESS';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  actionLabel?: string;
  actionPath?: string;
};

export type RecommendationsData = {
  period: { label: string; months: number; start: string; end: string };
  summary: {
    total: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  };
  recommendations: RecommendationItem[];
};

export function fetchRecommendations(months = 6) {
  return apiRequest<{ recommendations: RecommendationsData }>(
    `/api/recommendations?months=${months}`
  );
}
