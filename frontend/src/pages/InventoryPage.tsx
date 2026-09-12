import { useAuth } from '../context/AuthContext';
import { OwnerInventoryPage } from './OwnerInventoryPage';
import { StaffInventoryPage } from './StaffInventoryPage';

export function InventoryPage() {
  const { hasPermission } = useAuth();

  if (hasPermission('expenses.view')) {
    return <OwnerInventoryPage />;
  }

  return <StaffInventoryPage />;
}
