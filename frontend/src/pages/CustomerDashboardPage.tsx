import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCustomerCurrency } from '../hooks/useCustomerCurrency';
import { ApiClientError } from '../lib/api';
import { formatMoney as formatMoneyValue } from '../lib/money';
import * as customerPortalDashboardApi from '../services/customerPortalDashboardService';
import type { CustomerPortalDashboardData } from '../services/customerPortalDashboardService';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import './DashboardPage.css';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function CustomerDashboardPage() {
  const { user, hasPermission } = useAuth();
  const {
    preferredCurrency,
    usdToZmwRate,
  } = useCustomerCurrency();
  const formatMoney = (value: number) =>
    formatMoneyValue(value, { currency: preferredCurrency, usdToZmwRate });
  const canView =
    hasPermission('dashboard.view') && hasPermission('portal.purchases.view');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<CustomerPortalDashboardData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setError('You do not have permission to view the customer portal dashboard.');
        setLoading(false);
        return;
      }
      try {
        const result = await customerPortalDashboardApi.fetchCustomerPortalDashboard();
        if (active) {
          setDashboard(result.dashboard);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : 'Unable to load customer dashboard.'
          );
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
    return <Alert tone="error">You do not have permission to view the customer portal dashboard.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={8} />
      </Card>
    );
  }

  if (error || !dashboard) {
    return <Alert tone="error">{error || 'Customer dashboard unavailable.'}</Alert>;
  }

  const { kpis, recentPurchases, business, customer } = dashboard;

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <PageHeader
          title={`Welcome, ${user?.firstName || customer.name}`}
          subtitle={`${business.name} · your purchase overview`}
        />

        <div className="dashboard-hero__grid">
          <section className="dashboard-hero__kpis" aria-label="Purchase indicators">
            <article className="kpi-card kpi-card--blue">
              <p className="kpi-card__label">Total spent</p>
              <h2>{formatMoney(kpis.lifetimeSpent)}</h2>
              <p className="kpi-card__meta">
                {kpis.lifetimePurchaseCount} purchase
                {kpis.lifetimePurchaseCount === 1 ? '' : 's'} all time
              </p>
            </article>
            <article className="kpi-card kpi-card--red">
              <p className="kpi-card__label">This month</p>
              <h2>{formatMoney(kpis.monthSpent)}</h2>
              <p className="kpi-card__meta">
                {kpis.monthPurchaseCount} purchase
                {kpis.monthPurchaseCount === 1 ? '' : 's'} this month
              </p>
            </article>
            <article className="kpi-card kpi-card--orange">
              <p className="kpi-card__label">Purchases</p>
              <h2>{kpis.lifetimePurchaseCount}</h2>
              <p className="kpi-card__meta">Completed orders linked to your account</p>
            </article>
            <article className="kpi-card kpi-card--teal">
              <p className="kpi-card__label">Average order</p>
              <h2>{formatMoney(kpis.averageOrderValue)}</h2>
              <p className="kpi-card__meta">Across all completed purchases</p>
            </article>
          </section>

          <div className="dashboard-hero__panel">
            <p className="dashboard-hero__panel-title">Your account</p>
            <div className="health-block">
              <div className="health-block__row">
                <span>{customer.name}</span>
              </div>
              {customer.email ? <p className="kpi-card__meta">{customer.email}</p> : null}
            </div>
          </div>

          <aside className="dashboard-side">
            <Card title="Portal shortcuts">
              <div className="chip-list">
                <Link to="/app/portal/purchases" className="stock-chip">
                  <strong>My purchases</strong>
                  <span>View completed orders on your account</span>
                </Link>
                <Link to="/app/profile" className="stock-chip">
                  <strong>Profile</strong>
                  <span>Update your account details</span>
                </Link>
                <Link to="/app/portal/settings" className="stock-chip">
                  <strong>Settings</strong>
                  <span>Manage contact details on file</span>
                </Link>
              </div>
            </Card>
          </aside>
        </div>
      </section>

      <section className="dashboard-data">
        <p className="dashboard-data__tagline">
          Forecast your business growth and readily track here!!
        </p>

        <div className="dashboard-data__grid dashboard-data__full">
          <Card title="Recent purchases">
            {recentPurchases.length === 0 ? (
              <EmptyState
                title="No purchases yet"
                description="When this business records a sale for your customer account, it will appear here."
              />
            ) : (
              <>
                <ul className="recent-list">
                  {recentPurchases.map((purchase) => (
                    <li key={purchase.id} className="recent-list__item">
                      <div className="recent-list__icon" aria-hidden="true">
                        $
                      </div>
                      <div className="recent-list__body">
                        <strong>{purchase.saleNumber}</strong>
                        <span>
                          {purchase.items.map((item) => item.productName).join(', ') || 'Items'} ·{' '}
                          {purchase.itemCount} item
                          {purchase.itemCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="recent-list__meta">
                        <strong>{formatMoney(purchase.total)}</strong>
                        <span>{formatDate(purchase.soldAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="table-total">
                  <span>Total</span>
                  <span className="table-total__value">
                    {formatMoney(recentPurchases.reduce((sum, purchase) => sum + purchase.total, 0))}
                  </span>
                </div>
              </>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
