import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as reportsApi from '../services/reportsService';
import type { ReportTypeId } from '../services/reportsService';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import './dashboard.css';
import './ReportsPage.css';

const REPORTS: Array<{
  id: ReportTypeId;
  title: string;
  description: string;
  requiresCosts?: boolean;
}> = [
  {
    id: 'sales',
    title: 'Sales Report',
    description: 'Completed sales, revenue, and average order value for the selected period.',
  },
  {
    id: 'product_performance',
    title: 'Product Performance Report',
    description: 'Units sold and revenue by product.',
  },
  {
    id: 'inventory',
    title: 'Inventory Status Report',
    description: 'Current on-hand stock, low-stock items, and valuation.',
  },
  {
    id: 'expenses',
    title: 'Expense Report',
    description: 'Recorded expenses by category and date.',
  },
  {
    id: 'gross_profit',
    title: 'Gross Profit Report',
    description: 'Gross profit and margin by product for the selected period.',
    requiresCosts: true,
  },
  {
    id: 'forecast_recommendations',
    title: 'Forecast and Recommendations Report',
    description: 'Demand forecast and recommendations for the selected period.',
  },
  {
    id: 'business_summary',
    title: 'Business Summary Report',
    description: 'Sales, expenses, cash flow, inventory, and profit for the period.',
  },
];

function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addDays(value: Date, days: number): Date {
  const copy = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function ReportsPage() {
  const { hasPermission } = useAuth();
  const canViewCosts = hasPermission('products.costs.view');
  const today = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState(isoDate(startOfMonth(today)));
  const [endDate, setEndDate] = useState(isoDate(today));
  const [busyType, setBusyType] = useState<ReportTypeId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleReports = REPORTS.filter((report) => !report.requiresCosts || canViewCosts);

  function applyPreset(days: number | 'month') {
    const now = new Date();
    setEndDate(isoDate(now));
    if (days === 'month') {
      setStartDate(isoDate(startOfMonth(now)));
      return;
    }
    setStartDate(isoDate(addDays(now, -(days - 1))));
  }

  async function generate(reportType: ReportTypeId) {
    try {
      setError(null);
      setBusyType(reportType);
      await reportsApi.downloadReport(reportType, startDate, endDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate the PDF report.');
    } finally {
      setBusyType(null);
    }
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Reports</h1>
          <p className="dashboard-subtitle">
            Generate business-scoped PDF reports. Figures are taken from recorded data only and are
            not invented. Reports never change stock or prices.
          </p>
        </div>
      </div>

      <Card title="Reporting period">
        <div className="reports-presets">
          <Button type="button" variant="secondary" onClick={() => applyPreset('month')}>
            This month
          </Button>
          <Button type="button" variant="secondary" onClick={() => applyPreset(7)}>
            Last 7 days
          </Button>
          <Button type="button" variant="secondary" onClick={() => applyPreset(30)}>
            Last 30 days
          </Button>
          <Button type="button" variant="secondary" onClick={() => applyPreset(90)}>
            Last 90 days
          </Button>
        </div>
        <div className="reports-filters" style={{ marginTop: '16px' }}>
          <label>
            Start date
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            End date
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
      </Card>

      {error ? (
        <div style={{ marginTop: '16px' }}>
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <div className="reports-sections" style={{ marginTop: '20px' }}>
        {visibleReports.map((report) => (
          <Card key={report.id} title={report.title}>
            <p className="reports-section-summary">{report.description}</p>
            <Button
              type="button"
              onClick={() => void generate(report.id)}
              loading={busyType === report.id}
              disabled={busyType !== null}
            >
              Generate PDF
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
