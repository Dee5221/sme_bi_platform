import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as analyticsApi from '../services/analyticsService';
import type { BusinessAnalyticsData } from '../services/analyticsService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { GroupedBarChart, SimpleBarChart } from '../components/ui/SimpleBarChart';
import './BusinessAnalyticsPage.css';

const PERIOD_OPTIONS = [
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function BusinessAnalyticsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('analytics.view');
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<BusinessAnalyticsData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setError('You do not have permission to view business analytics.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await analyticsApi.fetchBusinessAnalytics(months);
        if (active) {
          setAnalytics(result.analytics);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiClientError ? err.message : 'Unable to load business analytics.'
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
    return <Alert tone="error">You do not have permission to view business analytics.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={10} />
      </Card>
    );
  }

  if (error || !analytics) {
    return <Alert tone="error">{error || 'Business analytics unavailable.'}</Alert>;
  }

  const { summary, monthlyTrend, topProducts, expensesByCategory, period } = analytics;
  const netTone = summary.netResult >= 0 ? 'green' : 'orange';

  return (
    <div className="business-analytics-page">
      <PageHeader
        title="Business Analytics"
        subtitle={`Cross-cutting performance view · ${period.label}`}
        actions={
          <div className="analytics-period">
            <label htmlFor="analytics-period">Period</label>
            <select
              id="analytics-period"
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

      <section className="analytics-kpi-grid" aria-label="Period summary">
        <article className="analytics-kpi analytics-kpi--revenue">
          <p>Total revenue</p>
          <h2>{formatMoney(summary.totalRevenue)}</h2>
          <span>{summary.totalSales} completed sales</span>
        </article>
        <article className="analytics-kpi analytics-kpi--expense">
          <p>Total expenses</p>
          <h2>{formatMoney(summary.totalExpenses)}</h2>
          <span>Recorded in period</span>
        </article>
        <article className="analytics-kpi analytics-kpi--net">
          <p>Net result</p>
          <h2>{formatMoney(summary.netResult)}</h2>
          <Badge tone={netTone}>{summary.netResult >= 0 ? 'Surplus' : 'Deficit'}</Badge>
        </article>
        <article className="analytics-kpi analytics-kpi--context">
          <p>Business context</p>
          <ul className="analytics-context-list">
            <li>{summary.activeProducts} active products</li>
            <li>{summary.activeCustomers} active customers</li>
            <li>{summary.lowStockCount} low-stock items</li>
          </ul>
        </article>
      </section>

      <div className="analytics-grid">
        <Card title="Revenue vs expenses trend">
          <GroupedBarChart
            groups={monthlyTrend.map((row) => ({
              key: row.key,
              label: row.label,
              values: [
                { key: 'revenue', value: row.revenue, tone: 'primary' },
                { key: 'expenses', value: row.expenses, tone: 'secondary' },
              ],
            }))}
            formatValue={formatMoney}
            legend={[
              { key: 'revenue', label: 'Revenue', tone: 'primary' },
              { key: 'expenses', label: 'Expenses', tone: 'secondary' },
            ]}
            emptyLabel="No revenue or expense activity in this period."
          />
        </Card>

        <Card title="Monthly net result">
          <SimpleBarChart
            series={monthlyTrend.map((row) => ({
              key: row.key,
              label: row.label,
              value: Math.abs(row.net),
              displayValue: row.net,
              tone: row.net >= 0 ? 'accent' : 'secondary',
            }))}
            formatValue={formatMoney}
            emptyLabel="No net result data for this period."
          />
        </Card>

        <Card title="Top products by revenue">
          {topProducts.length === 0 ? (
            <EmptyState
              title="No product sales yet"
              description="Completed sales in this period will appear here."
            />
          ) : (
            <SimpleBarChart
              series={topProducts.map((product) => ({
                key: product.productId,
                label: product.productSku,
                value: product.revenue,
                tone: 'primary',
              }))}
              formatValue={formatMoney}
            />
          )}
          {topProducts.length > 0 && (
            <ul className="analytics-rank-list">
              {topProducts.map((product, index) => (
                <li key={product.productId}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{product.productName}</strong>
                    <span>
                      {product.quantity} units · {formatMoney(product.revenue)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Expenses by category">
          {expensesByCategory.length === 0 ? (
            <EmptyState
              title="No expenses recorded"
              description="Expenses in this period will be grouped by category here."
            />
          ) : (
            <>
              <SimpleBarChart
                series={expensesByCategory.map((item, index) => ({
                  key: `${item.categoryName}-${index}`,
                  label: item.categoryName,
                  value: item.amount,
                  tone: 'secondary',
                }))}
                formatValue={formatMoney}
              />
              <ul className="analytics-rank-list">
                {expensesByCategory.map((item) => (
                  <li key={item.categoryName}>
                    <span>•</span>
                    <div>
                      <strong>{item.categoryName}</strong>
                      <span>{formatMoney(item.amount)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
