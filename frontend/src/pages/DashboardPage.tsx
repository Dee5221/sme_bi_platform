import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as analyticsApi from '../services/analyticsService';
import type { SummaryResponse } from '../services/analyticsService';
import { Card } from '../components/ui/Card';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import './dashboard.css';

function formatCurrency(amount: number): string {
  return `K${amount.toLocaleString('en-ZM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await analyticsApi.fetchSummary();
        if (active) setSummary(data);
      } catch (err: any) {
        if (active) setError(err.message || 'Unable to load dashboard data.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">Welcome back, {user?.email || 'User'}</p>
          </div>
        </div>
        <LoadingSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome back, {user?.email || 'User'}. Business overview for{' '}
            {summary?.period_start} to {summary?.period_end}.
          </p>
        </div>
        <Link to="/app/reports">
          <Button>View Reports</Button>
        </Link>
      </div>

      {summary && (
        <>
          <div className="dashboard-kpi-grid">
            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Total Revenue</div>
              <div className="dashboard-kpi-value">{formatCurrency(summary.total_revenue)}</div>
              <div className="dashboard-kpi-trend">Completed sales this period</div>
            </Card>

            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Total Expenses</div>
              <div className="dashboard-kpi-value">{formatCurrency(summary.total_expenses)}</div>
              <div className="dashboard-kpi-trend">Recorded expenses this period</div>
            </Card>

            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Net Cash Flow</div>
              <div className={`dashboard-kpi-value ${summary.net_cash_flow >= 0 ? 'text-success' : 'text-error'}`}>
                {formatCurrency(summary.net_cash_flow)}
              </div>
              <div className="dashboard-kpi-trend">Revenue minus expenses (excludes COGS)</div>
            </Card>

            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Transactions</div>
              <div className="dashboard-kpi-value">{summary.total_transactions}</div>
              <div className="dashboard-kpi-trend">Completed sales this period</div>
            </Card>

            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Avg. Order Value</div>
              <div className="dashboard-kpi-value">{formatCurrency(summary.aov)}</div>
              <div className="dashboard-kpi-trend">Per transaction</div>
            </Card>

            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Low Stock Alerts</div>
              <div className={`dashboard-kpi-value ${summary.low_stock_count > 0 ? 'text-warning' : ''}`}>
                {summary.low_stock_count}
              </div>
              <div className="dashboard-kpi-trend">Products at/below reorder level</div>
            </Card>
          </div>

          <div className="dashboard-note">
            <p>
              <strong>Note:</strong> Net Cash Flow is a limited proxy metric calculated as recorded
              sales revenue minus recorded expenses. It does not account for cost of goods sold (COGS),
              taxes, or other deductions. For full financial reporting, consult your accountant.
            </p>
          </div>
        </>
      )}
    </div>
  );
}