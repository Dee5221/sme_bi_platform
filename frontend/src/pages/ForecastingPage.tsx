import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as forecastingApi from '../services/forecastingService';
import type { ForecastingData } from '../services/forecastingService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { GroupedBarChart, SimpleBarChart } from '../components/ui/SimpleBarChart';
import './BusinessAnalyticsPage.css';

const LOOKBACK_OPTIONS = [
  { value: 3, label: '3 months history' },
  { value: 6, label: '6 months history' },
  { value: 12, label: '12 months history' },
];

const HORIZON_OPTIONS = [
  { value: 1, label: '1 month ahead' },
  { value: 2, label: '2 months ahead' },
  { value: 3, label: '3 months ahead' },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function urgencyTone(urgency: ForecastingData['inventoryForecasts'][number]['urgency']) {
  if (urgency === 'HIGH') return 'orange';
  if (urgency === 'MEDIUM') return 'orange';
  if (urgency === 'LOW') return 'green';
  return 'green';
}

export function ForecastingPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('forecasting.view');
  const [months, setMonths] = useState(6);
  const [horizon, setHorizon] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecasting, setForecasting] = useState<ForecastingData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setError('You do not have permission to view forecasting.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await forecastingApi.fetchForecasting(months, horizon);
        if (active) {
          setForecasting(result.forecasting);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof ApiClientError ? err.message : 'Unable to load forecasting.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canView, months, horizon]);

  if (!canView) {
    return <Alert tone="error">You do not have permission to view forecasting.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={10} />
      </Card>
    );
  }

  if (error || !forecasting) {
    return <Alert tone="error">{error || 'Forecasting unavailable.'}</Alert>;
  }

  const {
    methodology,
    lookback,
    forecastPeriod,
    historicalMonthly,
    forecastMonthly,
    summary,
    inventoryForecasts,
    dataQuality,
  } = forecasting;

  const combinedTrend = [
    ...historicalMonthly.map((row) => ({
      key: `hist-${row.key}`,
      label: row.label,
      revenue: row.revenue,
      expenses: row.expenses,
      kind: 'historical' as const,
    })),
    ...forecastMonthly.map((row) => ({
      key: `fc-${row.key}`,
      label: `${row.label}*`,
      revenue: row.revenue,
      expenses: row.expenses,
      kind: 'forecast' as const,
    })),
  ];

  const netTone = summary.projectedNetTotal >= 0 ? 'green' : 'orange';

  return (
    <div className="business-analytics-page">
      <PageHeader
        title="Forecasting"
        subtitle={`${methodology.label} · ${lookback.label} → ${forecastPeriod.label}`}
        actions={
          <div className="forecasting-controls">
            <div className="analytics-period">
              <label htmlFor="forecast-lookback">History</label>
              <select
                id="forecast-lookback"
                value={months}
                onChange={(event) => setMonths(Number(event.target.value))}
              >
                {LOOKBACK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="analytics-period">
              <label htmlFor="forecast-horizon">Forecast</label>
              <select
                id="forecast-horizon"
                value={horizon}
                onChange={(event) => setHorizon(Number(event.target.value))}
              >
                {HORIZON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      />

      <Alert tone="info">{methodology.description}</Alert>

      {!dataQuality.hasEnoughHistory && (
        <Alert tone="warning">
          Limited history available ({dataQuality.monthsWithSales} month
          {dataQuality.monthsWithSales === 1 ? '' : 's'} with sales). Projections may be less
          reliable until more data is recorded.
        </Alert>
      )}

      <section className="analytics-kpi-grid" aria-label="Forecast summary">
        <article className="analytics-kpi analytics-kpi--revenue">
          <p>Projected revenue</p>
          <h2>{formatMoney(summary.projectedRevenueTotal)}</h2>
          <span>
            Avg {formatMoney(summary.historicalAvgRevenue)}/mo · {summary.projectedSalesTotal}{' '}
            sales
          </span>
        </article>
        <article className="analytics-kpi analytics-kpi--expense">
          <p>Projected expenses</p>
          <h2>{formatMoney(summary.projectedExpensesTotal)}</h2>
          <span>Avg {formatMoney(summary.historicalAvgExpenses)}/mo</span>
        </article>
        <article className="analytics-kpi analytics-kpi--net">
          <p>Projected net</p>
          <h2>{formatMoney(summary.projectedNetTotal)}</h2>
          <Badge tone={netTone}>{summary.projectedNetTotal >= 0 ? 'Surplus' : 'Deficit'}</Badge>
        </article>
        <article className="analytics-kpi analytics-kpi--context">
          <p>History quality</p>
          <ul className="analytics-context-list">
            <li>{dataQuality.monthsWithSales} months with sales</li>
            <li>{dataQuality.monthsWithExpenses} months with expenses</li>
            <li>{inventoryForecasts.length} products tracked</li>
          </ul>
        </article>
      </section>

      <div className="analytics-grid">
        <Card title="Revenue: history vs projected average">
          <GroupedBarChart
            groups={combinedTrend.map((row) => ({
              key: row.key,
              label: row.label,
              values: [{ key: 'revenue', value: row.revenue, tone: 'primary' }],
            }))}
            formatValue={formatMoney}
            legend={[{ key: 'revenue', label: 'Revenue', tone: 'primary' }]}
            emptyLabel="No revenue history to forecast from."
          />
          <p className="forecast-footnote">* projected months use the historical monthly average</p>
        </Card>

        <Card title="Expenses: history vs projected average">
          <GroupedBarChart
            groups={combinedTrend.map((row) => ({
              key: row.key,
              label: row.label,
              values: [{ key: 'expenses', value: row.expenses, tone: 'secondary' }],
            }))}
            formatValue={formatMoney}
            legend={[{ key: 'expenses', label: 'Expenses', tone: 'secondary' }]}
            emptyLabel="No expense history to forecast from."
          />
        </Card>

        <Card title="Projected monthly net">
          <SimpleBarChart
            series={forecastMonthly.map((row) => ({
              key: row.key,
              label: row.label,
              value: Math.abs(row.netResult),
              displayValue: row.netResult,
              tone: row.netResult >= 0 ? 'accent' : 'secondary',
            }))}
            formatValue={formatMoney}
            emptyLabel="No forecast net result available."
          />
        </Card>

        <Card title="Inventory demand & restock outlook">
          {inventoryForecasts.length === 0 ? (
            <EmptyState
              title="No inventory to forecast"
              description="Add products and record sales to see demand projections."
              action={
                <Link to="/app/products">
                  <Button>Go to Products</Button>
                </Link>
              }
            />
          ) : (
            <ul className="analytics-rank-list forecasting-inventory-list">
              {inventoryForecasts.map((item) => (
                <li key={item.productId}>
                  <span>
                    <Badge tone={urgencyTone(item.urgency)}>{item.urgency}</Badge>
                  </span>
                  <div>
                    <strong>{item.productName}</strong>
                    <span>
                      {item.currentQuantity} on hand · avg demand{' '}
                      {item.averageMonthlyDemand}/mo
                      {item.estimatedDaysUntilStockout !== null
                        ? ` · ~${item.estimatedDaysUntilStockout} days left`
                        : ' · no recent demand'}
                      {item.suggestedRestockQuantity > 0
                        ? ` · restock ${item.suggestedRestockQuantity} suggested`
                        : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="side-link">
            <Link to="/app/inventory">Manage inventory →</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
