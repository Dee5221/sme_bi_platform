import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as dashboardApi from '../services/dashboardService';
import type { DashboardData } from '../services/dashboardService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import './DashboardPage.css';

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function OwnerDashboardPage() {
  const { user, hasPermission } = useAuth();
  const canView = hasPermission('dashboard.view');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setError('You do not have permission to view the dashboard.');
        setLoading(false);
        return;
      }
      try {
        const result = await dashboardApi.fetchDashboard();
        if (active) {
          setDashboard(result.dashboard);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof ApiClientError ? err.message : 'Unable to load dashboard.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canView]);

  if (!canView) {
    return <Alert tone="error">You do not have permission to view the dashboard.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={8} />
      </Card>
    );
  }

  if (error || !dashboard) {
    return <Alert tone="error">{error || 'Dashboard unavailable.'}</Alert>;
  }

  const { kpis, inventoryHealth, lowStockItems, recentSales, period, business } = dashboard;

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <PageHeader
          title={`Welcome, ${user?.firstName || 'Owner'}`}
          subtitle={`${business.name} · ${period.label} performance overview`}
        />

        <div className="dashboard-hero__grid">
          <section className="dashboard-hero__kpis" aria-label="Key performance indicators">
            <article className="kpi-card kpi-card--red">
              <p className="kpi-card__label">Revenue</p>
              <h2>{formatMoney(kpis.revenue)}</h2>
              <p className="kpi-card__meta">{kpis.revenueSaleCount} sales this month</p>
            </article>
            <article className="kpi-card kpi-card--blue">
              <p className="kpi-card__label">Expenses</p>
              <h2>{formatMoney(kpis.expenses)}</h2>
              <p className="kpi-card__meta">{kpis.expenseCount} records this month</p>
            </article>
            <article className="kpi-card kpi-card--orange">
              <p className="kpi-card__label">Products</p>
              <h2>{kpis.activeProducts}</h2>
              <p className="kpi-card__meta">Active catalog items</p>
            </article>
            <article className="kpi-card kpi-card--teal">
              <p className="kpi-card__label">Low stock</p>
              <h2>{kpis.lowStockCount}</h2>
              <p className="kpi-card__meta">Products at or below threshold</p>
            </article>
          </section>

          <div className="dashboard-hero__panel">
            <p className="dashboard-hero__panel-title">Inventory health</p>
            <div className="health-block">
              <div className="health-block__row">
                <span>
                  {inventoryHealth.healthyProducts} of {inventoryHealth.trackedProducts} healthy
                </span>
                <Badge tone={inventoryHealth.percentHealthy < 75 ? 'orange' : 'green'}>
                  {inventoryHealth.percentHealthy}% ok
                </Badge>
              </div>
              <div className="health-bar" aria-hidden="true">
                <div
                  className="health-bar__fill"
                  style={{ width: `${inventoryHealth.percentHealthy}%` }}
                />
              </div>
            </div>
            <section className="shortcut-grid" aria-label="Quick links" style={{ marginTop: '1rem' }}>
              <Link className="shortcut-card" to="/app/sales">
                Sales
              </Link>
              <Link className="shortcut-card" to="/app/products">
                Products
              </Link>
              <Link className="shortcut-card" to="/app/inventory">
                Inventory
              </Link>
              <Link className="shortcut-card" to="/app/expenses">
                Expenses
              </Link>
            </section>
          </div>

          <aside className="dashboard-side">
            <Link to="/app/sales" className="dash-cta">
              <span className="dash-cta__icon" aria-hidden="true">
                ↑
              </span>
              <strong>Add new sale</strong>
              <span>Record a transaction for this business</span>
            </Link>
          </aside>
        </div>
      </section>

      <section className="dashboard-data">
        <p className="dashboard-data__tagline">
          Forecast your business growth and readily track here!!
        </p>

        <div className="dashboard-data__grid">
          <Card title="Recent sales">
            {recentSales.length === 0 ? (
              <EmptyState
                title="No sales yet"
                description="Record a sale to see recent activity here."
                action={
                  <Link to="/app/sales">
                    <Button>Go to Sales</Button>
                  </Link>
                }
              />
            ) : (
              <>
                <ul className="recent-list">
                  {recentSales.map((sale) => (
                    <li key={sale.id} className="recent-list__item">
                      <div className="recent-list__icon" aria-hidden="true">
                        $
                      </div>
                      <div className="recent-list__body">
                        <strong>{sale.saleNumber}</strong>
                        <span>
                          {sale.customerName} · {sale.itemCount} item
                          {sale.itemCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="recent-list__meta">
                        <strong>{formatMoney(sale.total)}</strong>
                        <span>{formatDate(sale.soldAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="table-total">
                  <span>Total</span>
                  <span className="table-total__value">
                    {formatMoney(recentSales.reduce((sum, sale) => sum + sale.total, 0))}
                  </span>
                </div>
              </>
            )}
          </Card>

          <Card title="Low stock alerts">
            {lowStockItems.length === 0 ? (
              <EmptyState
                title="No low-stock products"
                description="Inventory levels are above their thresholds."
              />
            ) : (
              <>
                <div className="chip-list">
                  {lowStockItems.map((item) => (
                    <div key={item.inventoryId} className="stock-chip">
                      <strong>{item.productName}</strong>
                      <span>
                        {item.quantity} left · alert at {item.lowStockThreshold}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="side-link">
                  <Link to="/app/inventory">Manage inventory →</Link>
                </div>
              </>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
