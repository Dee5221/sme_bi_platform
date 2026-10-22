import { useEffect, useState } from 'react';
import * as analyticsApi from '../services/analyticsService';
import type { SummaryResponse } from '../services/analyticsService';
import { Card } from '../components/ui/Card';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Alert } from '../components/ui/Alert';
import './dashboard.css';

function formatCurrency(amount: number): string {
  return `K${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BusinessAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const data = await analyticsApi.fetchSummary();
        if (active) setSummary(data);
      } catch (err: any) {
        if (active) setError(err.message || 'Unable to load business analytics.');
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
            <h1 className="dashboard-title">Business Analytics</h1>
            <p className="dashboard-subtitle">Overall business performance overview.</p>
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
          <h1 className="dashboard-title">Business Analytics</h1>
          <p className="dashboard-subtitle">
            Performance summary for {summary?.period_start} to {summary?.period_end}.
          </p>
        </div>
      </div>

      {summary && (
        <>
          <div className="dashboard-kpi-grid">
            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Revenue</div>
              <div className="dashboard-kpi-value">{formatCurrency(summary.total_revenue)}</div>
            </Card>
            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Expenses</div>
              <div className="dashboard-kpi-value">{formatCurrency(summary.total_expenses)}</div>
            </Card>
            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Net Cash Flow</div>
              <div className={`dashboard-kpi-value ${summary.net_cash_flow >= 0 ? 'text-success' : 'text-error'}`}>
                {formatCurrency(summary.net_cash_flow)}
              </div>
            </Card>
            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Transactions</div>
              <div className="dashboard-kpi-value">{summary.total_transactions}</div>
            </Card>
            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Avg. Order Value</div>
              <div className="dashboard-kpi-value">{formatCurrency(summary.aov)}</div>
            </Card>
            <Card className="dashboard-kpi-card">
              <div className="dashboard-kpi-label">Low Stock Alerts</div>
              <div className="dashboard-kpi-value">{summary.low_stock_count}</div>
            </Card>
          </div>

          <div style={{ marginTop: '16px' }}>
            <Alert tone="warning">
              Net Cash Flow is a limited proxy metric (Revenue − Expenses). It excludes COGS,
              taxes, and other deductions. Period-specific inventory state is not tracked.
            </Alert>
          </div>
        </>
      )}
    </div>
  );
}