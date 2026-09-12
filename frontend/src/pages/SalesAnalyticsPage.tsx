import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as analyticsApi from '../services/analyticsService';
import type { SalesAnalyticsData } from '../services/analyticsService';
import { Alert } from '../components/ui/Alert';
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

export function SalesAnalyticsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('analytics.view');
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<SalesAnalyticsData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setError('You do not have permission to view sales analytics.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await analyticsApi.fetchSalesAnalytics(months);
        if (active) {
          setAnalytics(result.analytics);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiClientError ? err.message : 'Unable to load sales analytics.'
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
    return <Alert tone="error">You do not have permission to view sales analytics.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={10} />
      </Card>
    );
  }

  if (error || !analytics) {
    return <Alert tone="error">{error || 'Sales analytics unavailable.'}</Alert>;
  }

  const {
    summary,
    monthlyTrend,
    topProductsByRevenue,
    topProductsByQuantity,
    topCustomers,
    walkInSummary,
    period,
  } = analytics;

  return (
    <div className="business-analytics-page">
      <PageHeader
        title="Sales Analytics"
        subtitle={`Sales performance and customer insights · ${period.label}`}
        actions={
          <div className="analytics-period">
            <label htmlFor="sales-analytics-period">Period</label>
            <select
              id="sales-analytics-period"
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

      <section className="analytics-kpi-grid" aria-label="Sales summary">
        <article className="analytics-kpi analytics-kpi--revenue">
          <p>Total revenue</p>
          <h2>{formatMoney(summary.totalRevenue)}</h2>
          <span>{summary.totalSales} completed sales</span>
        </article>
        <article className="analytics-kpi analytics-kpi--net">
          <p>Average order value</p>
          <h2>{formatMoney(summary.averageOrderValue)}</h2>
          <span>Per completed sale</span>
        </article>
        <article className="analytics-kpi analytics-kpi--expense">
          <p>Units sold</p>
          <h2>{summary.totalUnitsSold}</h2>
          <span>Across all line items</span>
        </article>
        <article className="analytics-kpi analytics-kpi--context">
          <p>Sale mix</p>
          <ul className="analytics-context-list">
            <li>
              {summary.customerLinkedSales} customer sales · {formatMoney(summary.customerRevenue)}
            </li>
            <li>
              {summary.walkInSales} walk-in sales · {formatMoney(summary.walkInRevenue)}
            </li>
          </ul>
        </article>
      </section>

      <div className="analytics-grid">
        <Card title="Monthly revenue trend">
          <GroupedBarChart
            groups={monthlyTrend.map((row) => ({
              key: row.key,
              label: row.label,
              values: [{ key: 'revenue', value: row.revenue, tone: 'primary' }],
            }))}
            formatValue={formatMoney}
            legend={[{ key: 'revenue', label: 'Revenue', tone: 'primary' }]}
            emptyLabel="No sales revenue in this period."
          />
        </Card>

        <Card title="Monthly sales volume">
          <GroupedBarChart
            groups={monthlyTrend.map((row) => ({
              key: row.key,
              label: row.label,
              values: [
                { key: 'sales', value: row.salesCount, tone: 'primary' },
                { key: 'units', value: row.unitsSold, tone: 'accent' },
              ],
            }))}
            formatValue={(value) => String(value)}
            legend={[
              { key: 'sales', label: 'Sales', tone: 'primary' },
              { key: 'units', label: 'Units', tone: 'accent' },
            ]}
            emptyLabel="No sales activity in this period."
          />
        </Card>

        <Card title="Average order value by month">
          <SimpleBarChart
            series={monthlyTrend.map((row) => ({
              key: row.key,
              label: row.label,
              value: row.averageOrderValue,
              tone: 'accent',
            }))}
            formatValue={formatMoney}
            emptyLabel="No average order value data for this period."
          />
        </Card>

        <Card title="Top customers by revenue">
          {topCustomers.length === 0 && walkInSummary.salesCount === 0 ? (
            <EmptyState
              title="No customer sales yet"
              description="Sales linked to customers will appear here."
            />
          ) : (
            <>
              {topCustomers.length > 0 && (
                <SimpleBarChart
                  series={topCustomers.map((customer) => ({
                    key: customer.customerId,
                    label: customer.customerName.slice(0, 10),
                    value: customer.revenue,
                    tone: 'primary',
                  }))}
                  formatValue={formatMoney}
                />
              )}
              <ul className="analytics-rank-list">
                {topCustomers.map((customer, index) => (
                  <li key={customer.customerId}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{customer.customerName}</strong>
                      <span>
                        {customer.salesCount} sale{customer.salesCount === 1 ? '' : 's'} ·{' '}
                        {formatMoney(customer.revenue)}
                      </span>
                    </div>
                  </li>
                ))}
                {walkInSummary.salesCount > 0 && (
                  <li>
                    <span>•</span>
                    <div>
                      <strong>Walk-in (no customer)</strong>
                      <span>
                        {walkInSummary.salesCount} sale
                        {walkInSummary.salesCount === 1 ? '' : 's'} ·{' '}
                        {formatMoney(walkInSummary.revenue)}
                      </span>
                    </div>
                  </li>
                )}
              </ul>
            </>
          )}
        </Card>

        <Card title="Top products by revenue">
          {topProductsByRevenue.length === 0 ? (
            <EmptyState
              title="No product sales yet"
              description="Completed sales in this period will appear here."
            />
          ) : (
            <>
              <SimpleBarChart
                series={topProductsByRevenue.map((product) => ({
                  key: product.productId,
                  label: product.productSku,
                  value: product.revenue,
                  tone: 'primary',
                }))}
                formatValue={formatMoney}
              />
              <ul className="analytics-rank-list">
                {topProductsByRevenue.map((product, index) => (
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
            </>
          )}
        </Card>

        <Card title="Top products by units sold">
          {topProductsByQuantity.length === 0 ? (
            <EmptyState
              title="No product sales yet"
              description="Unit volumes from completed sales will appear here."
            />
          ) : (
            <>
              <SimpleBarChart
                series={topProductsByQuantity.map((product) => ({
                  key: `${product.productId}-qty`,
                  label: product.productSku,
                  value: product.quantity,
                  tone: 'accent',
                }))}
                formatValue={(value) => `${value} units`}
              />
              <ul className="analytics-rank-list">
                {topProductsByQuantity.map((product, index) => (
                  <li key={`${product.productId}-qty`}>
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
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
