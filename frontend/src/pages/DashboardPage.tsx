import { useAuth } from '../context/AuthContext';
import { AdminDashboardPage } from './AdminDashboardPage';
import { OwnerDashboardPage } from './OwnerDashboardPage';
import { StaffDashboardPage } from './StaffDashboardPage';

export function DashboardPage() {
  const { hasPermission } = useAuth();

  if (hasPermission('users.view')) {
    return <AdminDashboardPage />;
  }

  if (hasPermission('expenses.view')) {
    return <OwnerDashboardPage />;
  }

  return <StaffDashboardPage />;
}
