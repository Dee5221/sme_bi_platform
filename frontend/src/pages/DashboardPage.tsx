import { useAuth } from '../context/AuthContext';
import { AdminDashboardPage } from './AdminDashboardPage';
import { OwnerDashboardPage } from './OwnerDashboardPage';

export function DashboardPage() {
  const { hasPermission } = useAuth();

  if (hasPermission('users.view')) {
    return <AdminDashboardPage />;
  }

  return <OwnerDashboardPage />;
}
