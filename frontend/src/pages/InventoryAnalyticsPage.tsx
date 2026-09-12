import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as analyticsApi from '../services/analyticsService';
import type { InventoryAnalyticsData } from '../services/analyticsService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
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

export function InventoryAnalyticsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('analytics.view');
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<InventoryAnalyticsData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setError('You do not have permission to view inventory analytics.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await analyticsApi.fetchInventoryAnalytics(months);
        if (active) {
          setAnalytics(result.analytics);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiClientError ? err.message : 'Unable to load inventory analytics.'
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
    return <Alert tone="error">You do not have permission to view inventory analytics.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={10} />
      </Card>
    );
  }

  if (error || !analytics) {
    return <Alert tone="error">{error || 'Inventory analytics unavailable.'}</Alert>;
  }

  const {
    summary,
    monthlyTrend,
    lowStockProducts,
    topStockInProducts,
    topStockOutProducts,
    movementBreakdown,
    period,
  } = analytics;

  const healthTone = summary.percentHealthy < 75 ? 'orange' : 'green';

  return (
    <div className="business-analytics-page">
      <PageHeader
        title="Inventory Analytics"
        subtitle={`Stock health and movement trends · ${period.label}`}
        actions={
          <div className="analytics-period">
            <label htmlFor="inventory-analytics-period">Period</label>
            <select
              id="inventory-analytics-period"
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

      <section className="analytics-kpi-grid" aria-label="Inventory summary">
        <article className="analytics-kpi analytics-kpi--revenue">
          <p>Units on hand</p>
          <h2>{summary.totalUnitsOnHand}</h2>
          <span>{summary.trackedProducts} tracked products</span>
        </article>
        <article className="analytics-kpi analytics-kpi--net">
          <p>Inventory value</p>
          <h2>{formatMoney(summary.inventoryValue)}</h2>
          <span>Qty × current product price</span>
        </article>
        <article className="analytics-kpi analytics-kpi--expense">
          <p>Period movement</p>
          <h2>{summary.netMovement >= 0 ? '+' : ''}{summary.netMovement}</h2>
          <span>
            In {summary.periodStockIn} · Out {summary.periodStockOut}
          </span>
        </article>
        <article className="analytics-kpi analytics-kpi--context">
          <p>Stock health</p>
          <Badge tone={healthTone}>{summary.percentHealthy}% healthy</Badge>
          <ul className="analytics-context-list">
            <li>{summary.healthyStockCount} healthy</li>
            <li>{summary.lowStockCount} low stock</li>
            <li>{summary.outOfStockCount} out of stock</li>
          </ul>
        </article>
      </section>

      <div className="analytics-grid">
        <Card title="Stock in vs stock out trend">
          <GroupedBarChart
            groups={monthlyTrend.map((row) => ({
              key: row.key,
              label: row.label,
              values: [
                { key: 'stockIn', value: row.stockIn, tone: 'primary' },
                { key: 'stockOut', value: row.stockOut, tone: 'secondary' },
              ],
            }))}
            formatValue={(value) => `${value} units`}
            legend={[
              { key: 'stockIn', label: 'Stock in', tone: 'primary' },
              { key: 'stockOut', label: 'Stock out', tone: 'secondary' },
            ]}
            emptyLabel="No stock movements in this period."
          />
        </Card>

        <Card title="Monthly net movement">
          <SimpleBarChart
            series={monthlyTrend.map((row) => ({
              key: row.key,
              label: row.label,
              value: Math.abs(row.netMovement),
              displayValue: row.netMovement,
              tone: row.netMovement >= 0 ? 'accent' : 'secondary',
            }))}
            formatValue={(value) => `${value >= 0 ? '+' : ''}${value} units`}
            emptyLabel="No net movement data for this period."
          />
        </Card>

        <Card title="Low stock products">
          {lowStockProducts.length === 0 ? (
            <EmptyState
              title="No low-stock products"
              description="All tracked products are above their alert thresholds."
              action={
                <Link to="/app/inventory">
                  <Button>View inventory</Button>
                </Link>
              }
            />
          ) : (
            <>
              <SimpleBarChart
                series={lowStockProducts.map((item) => ({
                  key: item.inventoryId,
                  label: item.productSku,
                  value: item.quantity,
                  tone: 'secondary',
                }))}
                formatValue={(value) => `${value} left`}
              />
              <ul className="analytics-rank-list">
                {lowStockProducts.map((item) => (
                  <li key={item.inventoryId}>
                    <span>!</span>
                    <div>
                      <strong>{item.productName}</strong>
                      <span>
                        {item.quantity} left · alert at {item.lowStockThreshold}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="Movement breakdown">
          <ul className="analytics-rank-list">
            <li>
              <span>↑</span>
              <div>
                <strong>Stock in</strong>
                <span>
                  {movementBreakdown.stockInMovements} movement
                  {movementBreakdown.stockInMovements === 1 ? '' : 's'} ·{' '}
                  {movementBreakdown.stockInUnits} units
                </span>
              </div>
            </li>
            <li>
              <span>↓</span>
              <div>
                <strong>Stock out</strong>
                <span>
                  {movementBreakdown.stockOutMovements} movement
                  {movementBreakdown.stockOutMovements === 1 ? '' : 's'} ·{' '}
                  {movementBreakdown.stockOutUnits} units
                </span>
              </div>
            </li>
          </ul>
        </Card>

        <Card title="Top stock-in products">
          {topStockInProducts.length === 0 ? (
            <EmptyState
              title="No stock-in activity"
              description="Stock received in this period will appear here."
            />
          ) : (
            <>
              <SimpleBarChart
                series={topStockInProducts.map((product) => ({
                  key: product.productId,
                  label: product.productSku,
                  value: product.units,
                  tone: 'primary',
                }))}
                formatValue={(value) => `${value} units`}
              />
              <ul className="analytics-rank-list">
                {topStockInProducts.map((product, index) => (
                  <li key={product.productId}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{product.productName}</strong>
                      <span>
                        {product.units} units · {product.movements} movement
                        {product.movements === 1 ? '' : 's'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="Top stock-out products">
          {topStockOutProducts.length === 0 ? (
            <EmptyState
              title="No stock-out activity"
              description="Stock removed in this period will appear here."
            />
          ) : (
            <>
              <SimpleBarChart
                series={topStockOutProducts.map((product) => ({
                  key: product.productId,
                  label: product.productSku,
                  value: product.units,
                  tone: 'secondary',
                }))}
                formatValue={(value) => `${value} units`}
              />
              <ul className="analytics-rank-list">
                {topStockOutProducts.map((product, index) => (
                  <li key={product.productId}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{product.productName}</strong>
                      <span>
                        {product.units} units · {product.movements} movement
                        {product.movements === 1 ? '' : 's'}
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
