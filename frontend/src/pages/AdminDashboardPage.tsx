import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as usersApi from '../services/userService';
import * as salesApi from '../services/saleService';
import { Card } from '../components/ui/Card';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Badge } from '../components/ui/Badge';
import './dashboard.css';

interface User {
  id: number;
  name: string;
  email: string;
  status: string;
  role?: { role_name: string };
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [totalSales, setTotalSales] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);

      const [usersData, salesData] = await Promise.all([
        usersApi.listUsers({}).catch(() => []),
        salesApi.listSales({}).catch(() => ({ items: [] })),
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setTotalSales(salesData.items?.length || 0);
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
            Welcome back, {user?.email || 'User'}. System administration overview.
          </p>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Quick Stats */}
        <div className="dashboard-kpi-grid">
          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon dashboard-kpi-icon--sales">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="dashboard-kpi-content">
              <div className="dashboard-kpi-label">Total Users</div>
              <div className="dashboard-kpi-value">{users.length}</div>
              <div className="dashboard-kpi-trend">Registered accounts</div>
            </div>
          </Card>

          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon dashboard-kpi-icon--revenue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="dashboard-kpi-content">
              <div className="dashboard-kpi-label">Total Sales</div>
              <div className="dashboard-kpi-value">{totalSales}</div>
              <div className="dashboard-kpi-trend">All transactions</div>
            </div>
          </Card>
        </div>

        {/* Users List */}
        <Card className="dashboard-card">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">System Users</h2>
            <Link to="/app/users" className="dashboard-card-link">Manage users</Link>
          </div>
          <div className="dashboard-card-body">
            {users.length === 0 ? (
              <div className="dashboard-empty-state">
                <p>No users found</p>
              </div>
            ) : (
              <div className="dashboard-table-wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.slice(0, 10).map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td className="dashboard-table-td--muted">{u.email}</td>
                        <td>
                          <Badge tone="blue">{u.role?.role_name || 'N/A'}</Badge>
                        </td>
                        <td>
                          <Badge tone={u.status === 'active' ? 'green' : 'orange'}>
                            {u.status}
                          </Badge>
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