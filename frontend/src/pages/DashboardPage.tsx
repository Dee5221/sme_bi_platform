import { useAuth } from '../context/AuthContext';
import { AdminDashboardPage } from './AdminDashboardPage';
import { CustomerDashboardPage } from './CustomerDashboardPage';
import { OwnerDashboardPage } from './OwnerDashboardPage';
import { StaffDashboardPage } from './StaffDashboardPage';
import { SupplierDashboardPage } from './SupplierDashboardPage';

export function DashboardPage() {
  const { hasPermission } = useAuth();

  if (hasPermission('portal.purchases.view')) {
    return <CustomerDashboardPage />;
  }

  if (hasPermission('portal.products.view')) {
    return <SupplierDashboardPage />;
  }

  if (hasPermission('users.view')) {
    return <AdminDashboardPage />;
  }

  if (hasPermission('expenses.view')) {
    return <OwnerDashboardPage />;
  }

  return <StaffDashboardPage />;
}
