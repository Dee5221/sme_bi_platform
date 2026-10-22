import { useEffect, useState } from 'react';
import * as analyticsApi from '../services/analyticsService';
import type { InventoryHealthResponse } from '../services/analyticsService';
import { Card } from '../components/ui/Card';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Alert } from '../components/ui/Alert';
import './dashboard.css';

function formatCurrency(amount: number): string {
  return `K${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InventoryAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<InventoryHealthResponse | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const data = await analyticsApi.fetchInventoryHealth();
        if (active) setHealth(data);
      } catch (err: any) {
        if (active) setError(err.message || 'Unable to load inventory analytics.');
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
            <h1 className="dashboard-title">Inventory Analytics</h1>
            <p className="dashboard-subtitle">Current stock health and valuation.</p>
          </div>
        </div>
        <LoadingSkeleton rows={6} />
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
          <h1 className="dashboard-title">Inventory Analytics</h1>
          <p className="dashboard-subtitle">Current stock health and valuation.</p>
        </div>
      </div>

      {health && (
        <div className="dashboard-kpi-grid">
          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-label">Total Products</div>
            <div className="dashboard-kpi-value">{health.total_items}</div>
            <div className="dashboard-kpi-trend">Products with inventory records</div>
          </Card>

          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-label">Low Stock Items</div>
            <div className={`dashboard-kpi-value ${health.low_stock_items > 0 ? 'text-warning' : 'text-success'}`}>
              {health.low_stock_items}
            </div>
            <div className="dashboard-kpi-trend">At or below reorder level</div>
          </Card>

          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-label">Inventory Value</div>
            <div className="dashboard-kpi-value">
              {health.total_inventory_value !== null
                ? formatCurrency(health.total_inventory_value)
                : 'N/A'}
            </div>
            <div className="dashboard-kpi-trend">
              {health.note || 'Based on cost_price × quantity'}
            </div>
          </Card>
        </div>
      )}

      {health?.note && (
        <div style={{ marginTop: '16px' }}>
          <Alert tone="warning">{health.note}</Alert>
        </div>
      )}
    </div>
  );
}