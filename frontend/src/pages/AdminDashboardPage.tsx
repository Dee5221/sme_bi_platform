import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as adminDashboardApi from '../services/adminDashboardService';
import type { AdminDashboardData } from '../services/adminDashboardService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import './DashboardPage.css';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatAction(action: string) {
  return action.replace(/_/g, ' ').toLowerCase();
}

type QuickLink = {
  to: string;
  label: string;
  permission: string;
};

const quickLinks: QuickLink[] = [
  { to: '/app/users', label: 'Users', permission: 'users.view' },
  { to: '/app/roles', label: 'Roles & Permissions', permission: 'roles.view' },
  { to: '/app/activity-log', label: 'Activity Log', permission: 'audit.view' },
  {
    to: '/app/business-settings',
    label: 'Business Settings',
    permission: 'business.update',
  },
];

export function AdminDashboardPage() {
  const { user, hasPermission } = useAuth();
  const canView = hasPermission('users.view');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);

  const visibleQuickLinks = useMemo(
    () => quickLinks.filter((item) => hasPermission(item.permission)),
    [hasPermission]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setError('You do not have permission to view the administrator dashboard.');
        setLoading(false);
        return;
      }
      try {
        const result = await adminDashboardApi.fetchAdminDashboard();
        if (active) {
          setDashboard(result.dashboard);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiClientError ? err.message : 'Unable to load administrator dashboard.'
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
      <Alert tone="error">You do not have permission to view the administrator dashboard.</Alert>
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
    return <Alert tone="error">{error || 'Administrator dashboard unavailable.'}</Alert>;
  }

  const { kpis, recentActivity, period, business } = dashboard;

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <PageHeader
          title={`Welcome, ${user?.firstName || 'Administrator'}`}
          subtitle={`${business.name} · system administration overview`}
        />

        <div className="dashboard-hero__grid">
          <section className="dashboard-hero__kpis" aria-label="Administration indicators">
            <article className="kpi-card kpi-card--blue">
              <p className="kpi-card__label">Active users</p>
              <h2>{kpis.activeUsers}</h2>
              <p className="kpi-card__meta">Accounts currently enabled</p>
            </article>
            <article className="kpi-card kpi-card--orange">
              <p className="kpi-card__label">Inactive users</p>
              <h2>{kpis.inactiveUsers}</h2>
              <p className="kpi-card__meta">Deactivated accounts</p>
            </article>
            <article className="kpi-card kpi-card--teal">
              <p className="kpi-card__label">Roles in use</p>
              <h2>{kpis.rolesInUse}</h2>
              <p className="kpi-card__meta">Assigned across this business</p>
            </article>
            <article className="kpi-card kpi-card--red">
              <p className="kpi-card__label">Activity events</p>
              <h2>{kpis.auditEventsLast7Days}</h2>
              <p className="kpi-card__meta">{period.label.toLowerCase()}</p>
            </article>
          </section>

          <div className="dashboard-hero__panel">
            <p className="dashboard-hero__panel-title">Business status</p>
            <div className="health-block">
              <div className="health-block__row">
                <span>{business.name}</span>
                <Badge tone={business.isActive ? 'green' : 'orange'}>
                  {business.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {business.email ? <p className="kpi-card__meta">{business.email}</p> : null}
              {business.phone ? <p className="kpi-card__meta">{business.phone}</p> : null}
              <p className="kpi-card__meta">Created {formatDate(business.createdAt)}</p>
            </div>
            {visibleQuickLinks.length > 0 ? (
              <section className="shortcut-grid" aria-label="Administration shortcuts" style={{ marginTop: '1rem' }}>
                {visibleQuickLinks.map((item) => (
                  <Link key={item.to} className="shortcut-card" to={item.to}>
                    {item.label}
                  </Link>
                ))}
              </section>
            ) : null}
          </div>

          <aside className="dashboard-side">
            <Card title="Access overview">
              <div className="chip-list">
                <div className="stock-chip">
                  <strong>{kpis.activeUsers + kpis.inactiveUsers} total users</strong>
                  <span>
                    {kpis.activeUsers} active · {kpis.inactiveUsers} inactive
                  </span>
                </div>
                <div className="stock-chip">
                  <strong>{kpis.rolesInUse} roles assigned</strong>
                  <span>Across users in this business workspace</span>
                </div>
              </div>
              {hasPermission('audit.view') ? (
                <div className="side-link">
                  <Link to="/app/activity-log">View full activity log →</Link>
                </div>
              ) : null}
            </Card>
          </aside>
        </div>
      </section>

      <section className="dashboard-data">
        <p className="dashboard-data__tagline">
          Forecast your business growth and readily track here!!
        </p>

        <div className="dashboard-data__grid dashboard-data__full">
          <Card title="Recent activity">
            {recentActivity.length === 0 ? (
              <EmptyState
                title="No activity recorded yet"
                description="User actions and system events will appear here as your team uses the platform."
              />
            ) : (
              <ul className="recent-list">
                {recentActivity.map((entry) => (
                  <li key={entry.id} className="recent-list__item">
                    <div className="recent-list__icon" aria-hidden="true">
                      •
                    </div>
                    <div className="recent-list__body">
                      <strong>{formatAction(entry.action)}</strong>
                      <span>
                        {entry.entity}
                        {entry.entityId ? ` · ${entry.entityId}` : ''} · {entry.actorName}
                      </span>
                    </div>
                    <div className="recent-list__meta">
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {hasPermission('business.update') ? (
              <div className="side-link">
                <Link to="/app/business-settings">Manage business settings →</Link>
              </div>
            ) : null}
          </Card>
        </div>
      </section>
    </div>
  );
}
