import { useEffect, useState } from 'react';
import * as analyticsApi from '../services/analyticsService';
import type { SalesTrendPoint, SalesByCategoryItem } from '../services/analyticsService';
import { Card } from '../components/ui/Card';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Alert } from '../components/ui/Alert';
import './dashboard.css';

function formatCurrency(amount: number): string {
  return `K${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SalesAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<SalesTrendPoint[]>([]);
  const [byCategory, setByCategory] = useState<SalesByCategoryItem[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const [trendData, categoryData] = await Promise.all([
        analyticsApi.fetchSalesTrend({ ...params, group_by: groupBy }),
        analyticsApi.fetchSalesByCategory(params),
      ]);
      setTrend(trendData);
      setByCategory(categoryData);
    } catch (err: any) {
      setError(err.message || 'Unable to load sales analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [groupBy]);

  const maxRevenue = Math.max(...trend.map((t) => t.revenue), 1);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Sales Analytics</h1>
          <p className="dashboard-subtitle">Revenue trends and category performance.</p>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <Card>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                Group By
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'day' | 'month')}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              >
                <option value="day">Day</option>
                <option value="month">Month</option>
              </select>
            </div>
            <button
              onClick={loadData}
              style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Apply
            </button>
          </div>
        </Card>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <LoadingSkeleton rows={10} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Sales Trend Chart */}
          <Card>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Sales Trend</h2>
            {trend.length === 0 ? (
              <p style={{ color: '#64748b' }}>No sales data for the selected period.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {trend.map((point) => (
                  <div key={point.period} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', width: '80px', flexShrink: 0 }}>
                      {point.period}
                    </span>
                    <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(point.revenue / maxRevenue) * 100}%`,
                          background: '#2563eb',
                          height: '24px',
                          borderRadius: '4px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, width: '100px', textAlign: 'right' }}>
                      {formatCurrency(point.revenue)}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', width: '40px' }}>
                      {point.transactions} txns
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Sales by Category */}
          <Card>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Sales by Category</h2>
            {byCategory.length === 0 ? (
              <p style={{ color: '#64748b' }}>No category data for the selected period.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: '#64748b' }}>Category</th>
                    <th style={{ textAlign: 'right', padding: '8px', fontSize: '12px', color: '#64748b' }}>Revenue</th>
                    <th style={{ textAlign: 'right', padding: '8px', fontSize: '12px', color: '#64748b' }}>Units Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((item) => (
                    <tr key={item.category_name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 500 }}>{item.category_name}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(item.revenue)}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{item.units_sold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}