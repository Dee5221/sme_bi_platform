import { Card } from '../components/ui/Card';
import './dashboard.css';

export function CustomerAnalyticsPage() {
  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Customer Analytics</h1>
          <p className="dashboard-subtitle">Customer behaviour and engagement metrics.</p>
        </div>
      </div>

      <Card>
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>
            Customer Analytics — Coming Soon
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
            Repeat customer metrics and customer-linked transaction analysis will be
            available once the backend customer analytics endpoints are implemented.
            This requires verified customer-sale relationships with sufficient historical data.
          </p>
        </div>
      </Card>
    </div>
  );
}