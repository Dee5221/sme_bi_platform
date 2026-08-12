import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui/Alert';
import { AdminDashboardPage } from './AdminDashboardPage';
import { CustomerDashboardPage } from './CustomerDashboardPage';
import { OwnerDashboardPage } from './OwnerDashboardPage';
import { StaffDashboardPage } from './StaffDashboardPage';

export function DashboardPage() {
  const { hasPermission } = useAuth();

  if (hasPermission('portal.purchases.view')) {
    return <CustomerDashboardPage />;
  }

  if (hasPermission('portal.products.view')) {
    return (
      <Alert tone="info">
        The supplier portal dashboard will be added in the next step of Role 4.
      </Alert>
    );
  }

  if (hasPermission('users.view')) {
    return <AdminDashboardPage />;
  }

  if (hasPermission('expenses.view')) {
    return <OwnerDashboardPage />;
  }

  return <StaffDashboardPage />;
}
