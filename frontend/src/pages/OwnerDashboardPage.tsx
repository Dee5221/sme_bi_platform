import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as salesApi from '../services/saleService';
import * as inventoryApi from '../services/inventoryService';
import * as productsApi from '../services/productService';
import * as customersApi from '../services/customerService';
import { Card } from '../components/ui/Card';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Badge } from '../components/ui/Badge';
import './dashboard.css';

interface DashboardStats {
  totalRevenue: number;
  totalSales: number;
  avgOrderValue: number;
  lowStockCount: number;
  totalProducts: number;
  totalCustomers: number;
}

interface LowStockItem {
  product_id: number;
  product_name: string;
  quantity_on_hand: number;
  reorder_level: number;
}

export function OwnerDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);

      const [salesData, inventoryData, productsData, customersData] = await Promise.all([
        salesApi.listSales({}).catch(() => []),
        inventoryApi.listInventory({}).catch(() => []),
        productsApi.listProducts({}).catch(() => []),
        customersApi.listCustomers({}).catch(() => []),
      ]);

      // Handle both paginated {items:[]} and flat array responses
      const sales: any[] = Array.isArray(salesData)
        ? salesData
        : (salesData as any)?.items || [];

      const totalRevenue = sales.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0);
      const totalSales = sales.length;
      const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

      const inventory: any[] = Array.isArray(inventoryData)
        ? inventoryData
        : (inventoryData as any)?.items || [];

      const products: any[] = Array.isArray(productsData)
        ? productsData
        : (productsData as any)?.items || [];

      const lowStock: LowStockItem[] = [];

      inventory.forEach((inv: any) => {
        const product = products.find((p: any) => p.id === inv.product_id);
        if (product && inv.quantity_on_hand <= product.reorder_level) {
          lowStock.push({
            product_id: inv.product_id,
            product_name: product.name,
            quantity_on_hand: inv.quantity_on_hand,
            reorder_level: product.reorder_level,
          });
        }
      });

      setStats({
        totalRevenue,
        totalSales,
        avgOrderValue,
        lowStockCount: lowStock.length,
        totalProducts: products.length,
        totalCustomers: Array.isArray(customersData) ? customersData.length : 0,
      });

      setRecentSales(sales.slice(0, 5));
      setLowStockItems(lowStock.slice(0, 5));
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
          <LoadingSkeleton rows={8} />
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
            Welcome back, {user?.email || 'User'}. Here's what's happening with your business.
          </p>
        </div>
      </div>

      <div className="dashboard-content">
        {/* KPI Cards */}
        <div className="dashboard-kpi-grid">
          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon dashboard-kpi-icon--revenue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="dashboard-kpi-content">
              <div className="dashboard-kpi-label">Total Revenue</div>
              <div className="dashboard-kpi-value">
                K{stats?.totalRevenue.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <div className="dashboard-kpi-trend">All time sales</div>
            </div>
          </Card>

          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon dashboard-kpi-icon--sales">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="dashboard-kpi-content">
              <div className="dashboard-kpi-label">Total Sales</div>
              <div className="dashboard-kpi-value">{stats?.totalSales || 0}</div>
              <div className="dashboard-kpi-trend">Transactions completed</div>
            </div>
          </Card>

          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon dashboard-kpi-icon--avg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3v18h18M7 14l4-4 4 4 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="dashboard-kpi-content">
              <div className="dashboard-kpi-label">Avg. Order Value</div>
              <div className="dashboard-kpi-value">
                K{stats?.avgOrderValue.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <div className="dashboard-kpi-trend">Per transaction</div>
            </div>
          </Card>

          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon dashboard-kpi-icon--stock">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="dashboard-kpi-content">
              <div className="dashboard-kpi-label">Low Stock Alerts</div>
              <div className="dashboard-kpi-value">{stats?.lowStockCount || 0}</div>
              <div className="dashboard-kpi-trend">Products need restocking</div>
            </div>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="dashboard-grid">
          {/* Recent Sales */}
          <Card className="dashboard-card dashboard-card--wide">
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

          {/* Low Stock Alerts */}
          <Card className="dashboard-card">
            <div className="dashboard-card-header">
              <h2 className="dashboard-card-title">Low Stock Alerts</h2>
              <Link to="/app/inventory" className="dashboard-card-link">Manage inventory</Link>
            </div>
            <div className="dashboard-card-body">
              {lowStockItems.length === 0 ? (
                <div className="dashboard-empty-state">
                  <p>All products are well stocked</p>
                </div>
              ) : (
                <div className="dashboard-alert-list">
                  {lowStockItems.map((item) => (
                    <div key={item.product_id} className="dashboard-alert-item">
                      <div className="dashboard-alert-item-content">
                        <div className="dashboard-alert-item-name">{item.product_name}</div>
                        <div className="dashboard-alert-item-meta">
                          {item.quantity_on_hand} units left (reorder at {item.reorder_level})
                        </div>
                      </div>
                      <Badge tone="orange">Low</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="dashboard-quick-stats">
          <Card className="dashboard-quick-stat">
            <div className="dashboard-quick-stat-label">Total Products</div>
            <div className="dashboard-quick-stat-value">{stats?.totalProducts || 0}</div>
          </Card>
          <Card className="dashboard-quick-stat">
            <div className="dashboard-quick-stat-label">Total Customers</div>
            <div className="dashboard-quick-stat-value">{stats?.totalCustomers || 0}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}