import { useAuth } from '../context/AuthContext';
import { CustomerSettingsPage } from './CustomerSettingsPage';
import { SupplierSettingsPage } from './SupplierSettingsPage';

export function PortalSettingsPage() {
  const { hasPermission } = useAuth();

  if (hasPermission('portal.purchases.view')) {
    return <CustomerSettingsPage />;
  }

  if (hasPermission('portal.products.view')) {
    return <SupplierSettingsPage />;
  }

  return <CustomerSettingsPage />;
}
