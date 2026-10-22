import { Card } from '../components/ui/Card';
import './dashboard.css';

export function ReportsPage() {
  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Reports</h1>
          <p className="dashboard-subtitle">Generate and export business reports.</p>
        </div>
      </div>

      <Card>
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>
            Reports — Not Yet Available
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
            Report generation and CSV export functionality will be implemented as a separate
            extension. The analytics dashboard currently provides the core KPI views.
          </p>
        </div>
      </Card>
    </div>
  );
}