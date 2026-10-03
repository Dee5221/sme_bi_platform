import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as salesApi from '../services/saleService';
import { Card } from '../components/ui/Card';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Badge } from '../components/ui/Badge';
import './dashboard.css';

export function StaffDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [todaySales, setTodaySales] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);

      const salesData = await salesApi.listSales({}).catch(() => []);
      
      // Handle both flat array and paginated {items: []} responses
      const sales: any[] = Array.isArray(salesData)
        ? salesData
        : (salesData as any)?.items || [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todaySalesList = sales.filter((sale: any) => {
        const saleDate = new Date(sale.sale_datetime);
        return saleDate >= today;
      });

      setTodaySales(todaySalesList.length);
      setTodayRevenue(todaySalesList.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0));
      setRecentSales(sales.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">Welcome back, {user?.email || 'User'}</p>
          </div>
        </div>
        <div className="dashboard-content">
          <LoadingSkeleton rows={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome back, {user?.email || 'User'}. Here's your activity overview.
          </p>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Quick Stats */}
        <div className="dashboard-kpi-grid">
          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon dashboard-kpi-icon--sales">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="dashboard-kpi-content">
              <div className="dashboard-kpi-label">Today's Sales</div>
              <div className="dashboard-kpi-value">{todaySales}</div>
              <div className="dashboard-kpi-trend">Transactions today</div>
            </div>
          </Card>

          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon dashboard-kpi-icon--revenue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="dashboard-kpi-content">
              <div className="dashboard-kpi-label">Today's Revenue</div>
              <div className="dashboard-kpi-value">
                K{todayRevenue.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="dashboard-kpi-trend">Sales completed today</div>
            </div>
          </Card>
        </div>

        {/* Recent Sales */}
        <Card className="dashboard-card">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">Recent Sales</h2>
            <Link to="/app/sales" className="dashboard-card-link">View all</Link>
          </div>
          <div className="dashboard-card-body">
            {recentSales.length === 0 ? (
              <div className="dashboard-empty-state">
                <p>No sales recorded yet</p>
              </div>
            ) : (
              <div className="dashboard-table-wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th>Payment</th>
                      <th className="dashboard-table-th--right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((sale: any) => (
                      <tr key={sale.id}>
                        <td className="dashboard-table-td--muted">
                          {new Date(sale.sale_datetime).toLocaleDateString('en-ZM', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td>{sale.customer?.name || 'Walk-in Customer'}</td>
                        <td className="dashboard-table-td--muted">
                          {sale.items?.length || 0} item{(sale.items?.length || 0) !== 1 ? 's' : ''}
                        </td>
                        <td>
                          <Badge tone="neutral">{sale.payment_method}</Badge>
                        </td>
                        <td className="dashboard-table-td--right dashboard-table-td--bold">
                          K{(sale.total_amount || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}