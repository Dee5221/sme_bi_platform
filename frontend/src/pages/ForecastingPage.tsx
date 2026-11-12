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

const DEMAND_HORIZON_OPTIONS = [
  { value: 7, label: 'Next 7 days' },
  { value: 14, label: 'Next 14 days' },
  { value: 30, label: 'Next 30 days' },
];

function formatMoney(value: number) {
  return `K${value.toLocaleString('en-ZM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  const canViewCosts = hasPermission('products.costs.view');
  const [months, setMonths] = useState(6);
  const [horizon, setHorizon] = useState(3);
  const [demandHorizon, setDemandHorizon] = useState(7);
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
        const result = await forecastingApi.fetchForecasting(months, horizon, demandHorizon);
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
  }, [canView, months, horizon, demandHorizon]);

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
    productPerformance = [],
    profitability,
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
  const stockoutItems = inventoryForecasts.filter((item) => item.urgency === 'HIGH');
  const profitAvailable = Boolean(canViewCosts && profitability?.available);

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
              <label htmlFor="forecast-horizon">Monthly forecast</label>
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
            <div className="analytics-period">
              <label htmlFor="demand-horizon">Product demand</label>
              <select
                id="demand-horizon"
                value={demandHorizon}
                onChange={(event) => setDemandHorizon(Number(event.target.value))}
              >
                {DEMAND_HORIZON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      />

      {!dataQuality.hasEnoughHistory && (
        <Alert tone="warning">
          Not enough sales history for a reliable forecast yet.
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
          <p>Projected net cash</p>
          <h2>{formatMoney(summary.projectedNetTotal)}</h2>
          <Badge tone={netTone}>{summary.projectedNetTotal >= 0 ? 'Surplus' : 'Deficit'}</Badge>
        </article>
        <article className="analytics-kpi analytics-kpi--context">
          <p>History</p>
          <ul className="analytics-context-list">
            <li>{dataQuality.monthsWithSales} months with sales</li>
            <li>{dataQuality.monthsWithExpenses} months with expenses</li>
            <li>{inventoryForecasts.length} products tracked</li>
          </ul>
        </article>
      </section>

      <div className="analytics-grid">
        <Card title="Revenue: history vs forecast">
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
          <p className="forecast-footnote">* = forecast</p>
        </Card>

        <Card title="Expenses: history vs forecast">
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

        <Card title="Projected monthly net cash">
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

        <Card title="Stockout risk">
          {stockoutItems.length === 0 ? (
            <EmptyState
              title="No high-urgency stockouts"
              description="No products are forecast to run out in the next 7 days."
            />
          ) : (
            <ul className="analytics-rank-list forecasting-inventory-list">
              {stockoutItems.map((item) => (
                <li key={item.productId}>
                  <span>
                    <Badge tone={urgencyTone(item.urgency)}>{item.urgency}</Badge>
                  </span>
                  <div>
                    <strong>{item.productName}</strong>
                    <span>
                      {item.currentQuantity} on hand · {item.forecastDailyDemand ?? 0}/day forecast
                      {item.estimatedDaysUntilStockout !== null
                        ? ` · ~${item.estimatedDaysUntilStockout} days left`
                        : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="analytics-grid">
        <Card title="Top-selling products (last 30 days)">
          {productPerformance.length === 0 ? (
            <EmptyState
              title="No product sales in this window"
              description="Completed sales in the last 30 days will appear here."
            />
          ) : (
            <ul className="analytics-rank-list">
              {productPerformance.slice(0, 8).map((item, index) => (
                <li key={item.product_id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.product_name}</strong>
                    <span>
                      {item.units_sold} units · {formatMoney(item.revenue)} · velocity{' '}
                      {item.sales_velocity}/open day
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Top gross-profit contributors (last 30 days)">
          {!canViewCosts || !profitability ? (
            <Alert tone="info">Gross profit is not available for this account.</Alert>
          ) : !profitAvailable ? (
            <Alert tone="warning">Profit data unavailable.</Alert>
          ) : (
            <>
              <p className="forecast-footnote">
                Gross profit {formatMoney(profitability.gross_profit || 0)}
                {profitability.gross_margin_pct != null
                  ? ` · ${profitability.gross_margin_pct}% margin`
                  : ''}
              </p>
              <ul className="analytics-rank-list">
                {profitability.top_by_gross_profit.slice(0, 8).map((item, index) => (
                  <li key={item.product_id}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{item.product_name}</strong>
                      <span>
                        {formatMoney(item.gross_profit)} gross profit · margin{' '}
                        {item.gross_margin_pct ?? '—'}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card title={`Demand forecast table · next ${demandHorizon} days`}>
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
          <div className="forecast-table-wrap">
            <table className="forecast-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>On hand</th>
                  <th>Daily demand</th>
                  <th>Horizon demand</th>
                  <th>Days of cover</th>
                  <th>Cover estimate</th>
                  <th>Method</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {inventoryForecasts.map((item) => (
                  <tr key={item.productId}>
                    <td>
                      <strong>{item.productName}</strong>
                      <div className="forecast-table__muted">{item.productSku}</div>
                    </td>
                    <td>{item.currentQuantity}</td>
                    <td>{item.forecastDailyDemand ?? '—'}</td>
                    <td>{item.horizonDemand ?? '—'}</td>
                    <td>
                      {item.estimatedDaysUntilStockout === null
                        ? 'No recent demand'
                        : item.estimatedDaysUntilStockout}
                    </td>
                    <td>{item.suggestedRestockQuantity}</td>
                    <td>{item.selectedMethodLabel || item.selectedMethod || '—'}</td>
                    <td>
                      <Badge tone={urgencyTone(item.urgency)}>{item.urgency}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="side-link">
          <Link to="/app/inventory">Manage inventory →</Link>
        </div>
      </Card>
    </div>
  );
}
