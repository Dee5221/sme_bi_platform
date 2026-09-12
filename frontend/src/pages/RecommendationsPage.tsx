import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as recommendationsApi from '../services/recommendationsService';
import type { RecommendationItem, RecommendationsData } from '../services/recommendationsService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import './BusinessAnalyticsPage.css';
import './RecommendationsPage.css';

const PERIOD_OPTIONS = [
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
];

const CATEGORY_LABELS: Record<RecommendationItem['category'], string> = {
  INVENTORY: 'Inventory',
  SALES: 'Sales',
  EXPENSES: 'Expenses',
  CUSTOMERS: 'Customers',
  BUSINESS: 'Business',
};

function priorityTone(priority: RecommendationItem['priority']) {
  if (priority === 'HIGH') return 'orange';
  if (priority === 'MEDIUM') return 'orange';
  return 'green';
}

export function RecommendationsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('recommendations.view');
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendationsData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setError('You do not have permission to view recommendations.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await recommendationsApi.fetchRecommendations(months);
        if (active) {
          setData(result.recommendations);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiClientError ? err.message : 'Unable to load recommendations.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canView, months]);

  if (!canView) {
    return <Alert tone="error">You do not have permission to view recommendations.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={10} />
      </Card>
    );
  }

  if (error || !data) {
    return <Alert tone="error">{error || 'Recommendations unavailable.'}</Alert>;
  }

  const { summary, recommendations, period } = data;

  return (
    <div className="business-analytics-page recommendations-page">
      <PageHeader
        title="Recommendations"
        subtitle={`Actionable insights from your business data · ${period.label}`}
        actions={
          <div className="analytics-period">
            <label htmlFor="recommendations-period">Period</label>
            <select
              id="recommendations-period"
              value={months}
              onChange={(event) => setMonths(Number(event.target.value))}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <Alert tone="info">
        Recommendations are generated from your real sales, expenses, inventory, and customer
        activity using transparent business rules — not mock AI output.
      </Alert>

      <section className="analytics-kpi-grid" aria-label="Recommendation summary">
        <article className="analytics-kpi analytics-kpi--revenue">
          <p>Total recommendations</p>
          <h2>{summary.total}</h2>
          <span>Based on current data</span>
        </article>
        <article className="analytics-kpi analytics-kpi--expense">
          <p>High priority</p>
          <h2>{summary.highPriority}</h2>
          <span>Needs attention soon</span>
        </article>
        <article className="analytics-kpi analytics-kpi--net">
          <p>Medium priority</p>
          <h2>{summary.mediumPriority}</h2>
          <span>Review when possible</span>
        </article>
        <article className="analytics-kpi analytics-kpi--context">
          <p>Low priority</p>
          <h2>{summary.lowPriority}</h2>
          <span>Opportunities and positives</span>
        </article>
      </section>

      {recommendations.length === 0 ? (
        <Card title="Recommendations">
          <EmptyState
            title="No recommendations right now"
            description="As you record sales, expenses, and inventory activity, actionable suggestions will appear here."
            action={
              <Link to="/app/sales">
                <Button>Record a sale</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="recommendations-list">
          {recommendations.map((item) => (
            <Card key={item.id} title={item.title}>
              <div className="recommendation-card__meta">
                <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
                <Badge tone="green">{CATEGORY_LABELS[item.category]}</Badge>
              </div>
              <p className="recommendation-card__message">{item.message}</p>
              {item.actionPath && item.actionLabel ? (
                <div className="recommendation-card__action">
                  <Link to={item.actionPath}>
                    <Button variant="secondary">{item.actionLabel}</Button>
                  </Link>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
