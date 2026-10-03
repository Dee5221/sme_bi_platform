import { useAuth } from '../context/AuthContext';
import { AdminDashboardPage } from './AdminDashboardPage';
import { OwnerDashboardPage } from './OwnerDashboardPage';
import { StaffDashboardPage } from './StaffDashboardPage';

export function DashboardPage() {
  const { hasPermission } = useAuth();

  // Admin gets the admin dashboard
  if (hasPermission('users.view')) {
    return <AdminDashboardPage />;
  }

  // Owner gets the owner dashboard
  if (hasPermission('expenses.view')) {
    return <OwnerDashboardPage />;
  }

  // Staff gets the staff dashboard
  return <StaffDashboardPage />;
}