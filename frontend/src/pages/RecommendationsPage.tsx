import { useEffect, useState, useCallback } from 'react';
import * as recommendationsApi from '../services/recommendationsService';
import type {
  RecommendationsResponse,
  Recommendation,
  RecommendationSeverity,
  RecommendationCategory,
} from '../services/recommendationsService';
import { Card } from '../components/ui/Card';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import './RecommendationsPage.css';

// =============================================================================
// Constants
// =============================================================================

const SEVERITY_LABELS: Record<RecommendationSeverity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Info',
};

const SEVERITY_COLORS: Record<RecommendationSeverity, string> = {
  CRITICAL: 'severity-critical',
  HIGH: 'severity-high',
  MEDIUM: 'severity-medium',
  LOW: 'severity-low',
  INFO: 'severity-info',
};

const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  inventory: 'Inventory',
  sales: 'Sales',
  expenses: 'Expenses',
  profitability: 'Profitability',
};

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'sales', label: 'Sales' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'profitability', label: 'Profitability' },
];

const SEVERITY_FILTER_OPTIONS = [
  { value: '', label: 'All Severities' },
  { value: 'CRITICAL', label: 'Critical only' },
  { value: 'HIGH', label: 'High & above' },
  { value: 'MEDIUM', label: 'Medium & above' },
  { value: 'LOW', label: 'Low & above' },
];

const MONTH_OPTIONS = [
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 9, label: '9 months' },
  { value: 12, label: '12 months' },
];

// =============================================================================
// Component
// =============================================================================

export function RecommendationsPage() {
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendationsResponse | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [monthsFilter, setMonthsFilter] = useState(6);

  const loadRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: recommendationsApi.RecommendationFilters = {
        months: monthsFilter,
      };

      if (categoryFilter) {
        filters.categories = categoryFilter;
      }
      if (severityFilter) {
        filters.severity = severityFilter;
      }

      const response = await recommendationsApi.fetchRecommendations(filters);
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Unable to load recommendations.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, severityFilter, monthsFilter]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  // ==========================================================================
  // Render: Loading State
  // ==========================================================================
  if (loading) {
    return (
      <div className="recommendations-page">
        <div className="recommendations-header">
          <div>
            <h1 className="recommendations-title">Decision Support &amp; Recommendations</h1>
            <p className="recommendations-subtitle">Loading recommendations…</p>
          </div>
        </div>
        <LoadingSkeleton rows={8} />
      </div>
    );
  }

  // ==========================================================================
  // Render: Error State
  // ==========================================================================
  if (error) {
    return (
      <div className="recommendations-page">
        <div className="recommendations-header">
          <div>
            <h1 className="recommendations-title">Decision Support &amp; Recommendations</h1>
            <p className="recommendations-subtitle">Suggested actions for inventory, sales, and expenses.</p>
          </div>
        </div>
        <Alert tone="error">
          {error}
          <div style={{ marginTop: '12px' }}>
            <Button onClick={loadRecommendations}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  // ==========================================================================
  // Render: No Data
  // ==========================================================================
  if (!data) {
    return (
      <div className="recommendations-page">
        <div className="recommendations-header">
          <div>
            <h1 className="recommendations-title">Decision Support &amp; Recommendations</h1>
          </div>
        </div>
        <Alert tone="warning">No recommendation data available.</Alert>
      </div>
    );
  }

  // ==========================================================================
  // Render: Main Content
  // ==========================================================================
  const { recommendations, summary, analysis_period, generated_at } = data;

  return (
    <div className="recommendations-page">
      {/* Page Header */}
      <div className="recommendations-header">
        <div>
          <h1 className="recommendations-title">Decision Support &amp; Recommendations</h1>
          <p className="recommendations-subtitle">
            Suggested actions for inventory, sales, and expenses.
          </p>
        </div>
        <div className="recommendations-meta">
          <span className="meta-item">
            Period: {analysis_period.start} to {analysis_period.end} ({analysis_period.months} months)
          </span>
          <span className="meta-item">
            Generated: {new Date(generated_at).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Filters */}
      <Card className="recommendations-filters-card">
        <div className="recommendations-filters">
          <div className="filter-group">
            <label className="filter-label">Category</label>
            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Minimum Severity</label>
            <select
              className="filter-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              {SEVERITY_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Analysis Period</label>
            <select
              className="filter-select"
              value={monthsFilter}
              onChange={(e) => setMonthsFilter(Number(e.target.value))}
            >
              {MONTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <Button onClick={loadRecommendations}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="recommendations-summary-grid">
        <Card className="summary-card">
          <div className="summary-label">Total</div>
          <div className="summary-value">{data.total_recommendations}</div>
        </Card>
        <Card className="summary-card summary-critical">
          <div className="summary-label">Critical</div>
          <div className="summary-value">{summary.by_severity.CRITICAL}</div>
        </Card>
        <Card className="summary-card summary-high">
          <div className="summary-label">High</div>
          <div className="summary-value">{summary.by_severity.HIGH}</div>
        </Card>
        <Card className="summary-card summary-medium">
          <div className="summary-label">Medium</div>
          <div className="summary-value">{summary.by_severity.MEDIUM}</div>
        </Card>
        <Card className="summary-card summary-low">
          <div className="summary-label">Low</div>
          <div className="summary-value">{summary.by_severity.LOW}</div>
        </Card>
      </div>

      {/* Recommendations List */}
      {recommendations.length === 0 ? (
        <Card className="recommendations-empty">
          <div className="empty-state">
            <h3>No recommendations</h3>
            <p>Nothing to show for the selected filters and period.</p>
          </div>
        </Card>
      ) : (
        <div className="recommendations-list">
          {recommendations.map((rec) => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      )}

    </div>
  );
}

// =============================================================================
// Recommendation Card Component
// =============================================================================

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const {
    severity,
    category,
    title,
    explanation,
    suggested_action,
    affected_entity,
    metrics,
    period,
    audience,
  } = recommendation;

  return (
    <Card className={`recommendation-card ${SEVERITY_COLORS[severity]}`}>
      <div className="recommendation-card-header">
        <div className="recommendation-card-badges">
          <span className={`badge badge-severity ${SEVERITY_COLORS[severity]}`}>
            {SEVERITY_LABELS[severity]}
          </span>
          <span className="badge badge-category">
            {CATEGORY_LABELS[category] || category}
          </span>
          {audience ? (
            <span className="badge badge-category">
              {audience === 'strategic' ? 'Strategic' : 'Operational'}
            </span>
          ) : null}
        </div>
        <h3 className="recommendation-card-title">{title}</h3>
      </div>

      <div className="recommendation-card-body">
        {period ? (
          <div className="recommendation-section">
            <h4 className="section-label">Time period</h4>
            <p className="section-content">{period}</p>
          </div>
        ) : null}

        <div className="recommendation-section">
          <h4 className="section-label">Reason</h4>
          <p className="section-content">{explanation}</p>
        </div>

        {/* Suggested Action */}
        <div className="recommendation-section">
          <h4 className="section-label">Suggested Action</h4>
          <p className="section-content">{suggested_action}</p>
        </div>

        {/* Affected Entity */}
        {affected_entity && (
          <div className="recommendation-section">
            <h4 className="section-label">Affected Entity</h4>
            <p className="section-content">
              {affected_entity.name || 'N/A'}
              {affected_entity.sku && ` (${affected_entity.sku})`}
              {affected_entity.type && ` — ${affected_entity.type}`}
            </p>
          </div>
        )}

        {/* Metrics */}
        {metrics && Object.keys(metrics).length > 0 && (
          <div className="recommendation-section">
            <h4 className="section-label">Supporting Metrics</h4>
            <div className="metrics-grid">
              {Object.entries(metrics).map(([key, value]) => (
                <div key={key} className="metric-item">
                  <span className="metric-label">{formatMetricLabel(key)}</span>
                  <span className="metric-value">{formatMetricValue(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Card>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatMetricLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMetricValue(value: number | string | boolean | null): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(2);
  }
  return String(value);
}