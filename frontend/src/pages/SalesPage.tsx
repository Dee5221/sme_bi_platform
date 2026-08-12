import { useAuth } from '../context/AuthContext';
import { OwnerSalesPage } from './OwnerSalesPage';
import { StaffSalesPage } from './StaffSalesPage';

export function SalesPage() {
  const { hasPermission } = useAuth();

  if (hasPermission('expenses.view')) {
    return <OwnerSalesPage />;
  }

  return <StaffSalesPage />;
}
