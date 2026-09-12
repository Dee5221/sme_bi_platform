import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as supplierPortalDashboardApi from '../services/supplierPortalDashboardService';
import type { SupplierPortalDashboardData } from '../services/supplierPortalDashboardService';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import './DashboardPage.css';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function SupplierDashboardPage() {
  const { user, hasPermission } = useAuth();
  const canView =
    hasPermission('dashboard.view') && hasPermission('portal.products.view');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<SupplierPortalDashboardData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setError('You do not have permission to view the supplier portal dashboard.');
        setLoading(false);
        return;
      }
      try {
        const result = await supplierPortalDashboardApi.fetchSupplierPortalDashboard();
        if (active) {
          setDashboard(result.dashboard);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : 'Unable to load supplier dashboard.'
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
    return (
      <Alert tone="error">You do not have permission to view the supplier portal dashboard.</Alert>
    );
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={8} />
      </Card>
    );
  }

  if (error || !dashboard) {
    return <Alert tone="error">{error || 'Supplier dashboard unavailable.'}</Alert>;
  }

  const { kpis, recentSupplyRecords, business, supplier } = dashboard;

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <PageHeader
          title={`Welcome, ${user?.firstName || supplier.name}`}
          subtitle={`${business.name} · your supply overview`}
        />

        <div className="dashboard-hero__grid">
          <section className="dashboard-hero__kpis" aria-label="Supply indicators">
            <article className="kpi-card kpi-card--blue">
              <p className="kpi-card__label">Units supplied</p>
              <h2>{kpis.lifetimeUnitsSupplied}</h2>
              <p className="kpi-card__meta">
                {kpis.lifetimeSupplyRecords} stock-in record
                {kpis.lifetimeSupplyRecords === 1 ? '' : 's'} all time
              </p>
            </article>
            <article className="kpi-card kpi-card--red">
              <p className="kpi-card__label">This month</p>
              <h2>{kpis.monthUnitsSupplied}</h2>
              <p className="kpi-card__meta">
                {kpis.monthSupplyRecords} record
                {kpis.monthSupplyRecords === 1 ? '' : 's'} this month
              </p>
            </article>
            <article className="kpi-card kpi-card--orange">
              <p className="kpi-card__label">Products supplied</p>
              <h2>{kpis.productsSupplied}</h2>
              <p className="kpi-card__meta">Distinct products linked to your deliveries</p>
            </article>
            <article className="kpi-card kpi-card--teal">
              <p className="kpi-card__label">Average delivery</p>
              <h2>{kpis.averageUnitsPerRecord}</h2>
              <p className="kpi-card__meta">Units per stock-in record</p>
            </article>
          </section>

          <div className="dashboard-hero__panel">
            <p className="dashboard-hero__panel-title">Your account</p>
            <div className="health-block">
              <div className="health-block__row">
                <span>{supplier.name}</span>
              </div>
              {supplier.email ? <p className="kpi-card__meta">{supplier.email}</p> : null}
            </div>
          </div>

          <aside className="dashboard-side">
            <Card title="Portal shortcuts">
              <div className="chip-list">
                <Link to="/app/portal/products" className="stock-chip">
                  <strong>Products supplied</strong>
                  <span>View products linked to your deliveries</span>
                </Link>
                <Link to="/app/portal/records" className="stock-chip">
                  <strong>Purchase records</strong>
                  <span>Review stock-in deliveries on your account</span>
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
          <Card title="Recent supply records">
            {recentSupplyRecords.length === 0 ? (
              <EmptyState
                title="No supply records yet"
                description="When this business records stock-in linked to your supplier account, it will appear here."
              />
            ) : (
              <>
                <ul className="recent-list">
                  {recentSupplyRecords.map((record) => (
                    <li key={record.id} className="recent-list__item">
                      <div className="recent-list__icon" aria-hidden="true">
                        +
                      </div>
                      <div className="recent-list__body">
                        <strong>{record.productName}</strong>
                        <span>
                          {record.productSku} · {record.quantity} units
                          {record.reason ? ` · ${record.reason}` : ''}
                        </span>
                      </div>
                      <div className="recent-list__meta">
                        <strong>{record.quantity}</strong>
                        <span>{formatDate(record.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="table-total">
                  <span>Total units</span>
                  <span className="table-total__value">
                    {recentSupplyRecords.reduce((sum, record) => sum + record.quantity, 0)}
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
