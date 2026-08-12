import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as analyticsApi from '../services/analyticsService';
import type { CustomerAnalyticsData } from '../services/analyticsService';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { SimpleBarChart } from '../components/ui/SimpleBarChart';
import { Button } from '../components/ui/Button';
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

export function CustomerAnalyticsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('analytics.view');
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<CustomerAnalyticsData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setError('You do not have permission to view customer analytics.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await analyticsApi.fetchCustomerAnalytics(months);
        if (active) {
          setAnalytics(result.analytics);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiClientError ? err.message : 'Unable to load customer analytics.'
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
    return <Alert tone="error">You do not have permission to view customer analytics.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={10} />
      </Card>
    );
  }

  if (error || !analytics) {
    return <Alert tone="error">{error || 'Customer analytics unavailable.'}</Alert>;
  }

  const {
    summary,
    monthlyTrend,
    topCustomersByRevenue,
    topCustomersBySalesCount,
    walkInSummary,
    customerMix,
    period,
  } = analytics;

  return (
    <div className="business-analytics-page">
      <PageHeader
        title="Customer Analytics"
        subtitle={`Customer growth and purchase behavior · ${period.label}`}
        actions={
          <div className="analytics-period">
            <label htmlFor="customer-analytics-period">Period</label>
            <select
              id="customer-analytics-period"
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

      <section className="analytics-kpi-grid" aria-label="Customer summary">
        <article className="analytics-kpi analytics-kpi--revenue">
          <p>Active customers</p>
          <h2>{summary.activeCustomers}</h2>
          <span>{summary.newCustomersInPeriod} new in period</span>
        </article>
        <article className="analytics-kpi analytics-kpi--net">
          <p>Customer revenue</p>
          <h2>{formatMoney(summary.customerRevenue)}</h2>
          <span>{summary.customerLinkedSales} linked sales</span>
        </article>
        <article className="analytics-kpi analytics-kpi--expense">
          <p>Avg revenue / customer</p>
          <h2>{formatMoney(summary.averageRevenuePerCustomer)}</h2>
          <span>{summary.customersWithSalesInPeriod} customers with sales</span>
        </article>
        <article className="analytics-kpi analytics-kpi--context">
          <p>Customer mix</p>
          <ul className="analytics-context-list">
            <li>{customerMix.repeatCustomers} repeat customers</li>
            <li>{customerMix.oneTimeCustomers} one-time customers</li>
            <li>{customerMix.walkInSales} walk-in sales</li>
          </ul>
        </article>
      </section>

      <div className="analytics-grid">
        <Card title="New customers by month">
          <SimpleBarChart
            series={monthlyTrend.map((row) => ({
              key: row.key,
              label: row.label,
              value: row.newCustomers,
              tone: 'accent',
            }))}
            formatValue={(value) => `${value} new`}
            emptyLabel="No new customers in this period."
          />
        </Card>

        <Card title="Customer sales by month">
          <SimpleBarChart
            series={monthlyTrend.map((row) => ({
              key: row.key,
              label: row.label,
              value: row.customerSales,
              tone: 'primary',
            }))}
            formatValue={(value) => `${value} sales`}
            emptyLabel="No customer-linked sales in this period."
          />
        </Card>

        <Card title="Customer revenue by month">
          <SimpleBarChart
            series={monthlyTrend.map((row) => ({
              key: row.key,
              label: row.label,
              value: row.customerRevenue,
              tone: 'secondary',
            }))}
            formatValue={formatMoney}
            emptyLabel="No customer revenue in this period."
          />
        </Card>

        <Card title="Top customers by revenue">
          {topCustomersByRevenue.length === 0 ? (
            <EmptyState
              title="No customer sales yet"
              description="Sales linked to customers will appear here."
              action={
                <Link to="/app/customers">
                  <Button>View customers</Button>
                </Link>
              }
            />
          ) : (
            <>
              <SimpleBarChart
                series={topCustomersByRevenue.map((customer) => ({
                  key: customer.customerId,
                  label: customer.customerName.slice(0, 10),
                  value: customer.revenue,
                  tone: 'primary',
                }))}
                formatValue={formatMoney}
              />
              <ul className="analytics-rank-list">
                {topCustomersByRevenue.map((customer, index) => (
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

        <Card title="Top customers by purchase frequency">
          {topCustomersBySalesCount.length === 0 ? (
            <EmptyState
              title="No repeat activity yet"
              description="Customers with multiple purchases will rank here."
            />
          ) : (
            <>
              <SimpleBarChart
                series={topCustomersBySalesCount.map((customer) => ({
                  key: `${customer.customerId}-count`,
                  label: customer.customerName.slice(0, 10),
                  value: customer.salesCount,
                  tone: 'accent',
                }))}
                formatValue={(value) => `${value} sales`}
              />
              <ul className="analytics-rank-list">
                {topCustomersBySalesCount.map((customer, index) => (
                  <li key={`${customer.customerId}-count`}>
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
              </ul>
            </>
          )}
        </Card>

        <Card title="Walk-in vs customer sales">
          <SimpleBarChart
            series={[
              {
                key: 'customer',
                label: 'Customer',
                value: summary.customerLinkedSales,
                displayValue: summary.customerLinkedSales,
                tone: 'primary',
              },
              {
                key: 'walkin',
                label: 'Walk-in',
                value: summary.walkInSales,
                displayValue: summary.walkInSales,
                tone: 'secondary',
              },
            ]}
            formatValue={(value) => `${value} sales`}
            emptyLabel="No sales in this period."
          />
          <ul className="analytics-rank-list">
            <li>
              <span>◉</span>
              <div>
                <strong>Customer-linked</strong>
                <span>{formatMoney(summary.customerRevenue)} revenue</span>
              </div>
            </li>
            <li>
              <span>○</span>
              <div>
                <strong>Walk-in</strong>
                <span>{formatMoney(summary.walkInRevenue)} revenue</span>
              </div>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
