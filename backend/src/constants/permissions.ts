export const OWNER_MANAGER_PERMISSIONS = [
  { key: 'business.view', description: 'View business profile' },
  { key: 'dashboard.view', description: 'View dashboard' },
  { key: 'products.view', description: 'View products' },
  { key: 'products.create', description: 'Create products' },
  { key: 'products.update', description: 'Update products' },
  { key: 'products.delete', description: 'Deactivate products' },
  { key: 'inventory.view', description: 'View inventory' },
  { key: 'inventory.adjust', description: 'Adjust stock levels' },
  { key: 'customers.view', description: 'View customers' },
  { key: 'customers.create', description: 'Create customers' },
  { key: 'customers.update', description: 'Update customers' },
  { key: 'customers.delete', description: 'Deactivate customers' },
  { key: 'suppliers.view', description: 'View suppliers' },
  { key: 'suppliers.create', description: 'Create suppliers' },
  { key: 'suppliers.update', description: 'Update suppliers' },
  { key: 'suppliers.delete', description: 'Deactivate suppliers' },
  { key: 'sales.view', description: 'View sales' },
  { key: 'sales.create', description: 'Create sales' },
  { key: 'sales.update', description: 'Update sales (limited)' },
  { key: 'expenses.view', description: 'View expenses' },
  { key: 'expenses.create', description: 'Create expenses' },
  { key: 'expenses.update', description: 'Update expenses' },
  { key: 'expenses.delete', description: 'Deactivate expenses' },
  { key: 'analytics.view', description: 'View analytics' },
  { key: 'forecasting.view', description: 'View forecasts' },
  { key: 'recommendations.view', description: 'View recommendations' },
  { key: 'reports.view', description: 'View reports' },
  { key: 'profile.view', description: 'View own profile' },
  { key: 'profile.update', description: 'Update own profile' },
] as const;

export const ADMINISTRATOR_PERMISSIONS = [
  { key: 'dashboard.view', description: 'View dashboard' },
  { key: 'users.view', description: 'View users' },
  { key: 'users.create', description: 'Create users' },
  { key: 'users.update', description: 'Update users' },
  { key: 'users.delete', description: 'Deactivate users' },
  { key: 'roles.view', description: 'View roles and permissions' },
  { key: 'roles.manage', description: 'Manage role permissions' },
  { key: 'audit.view', description: 'View activity log' },
  { key: 'business.view', description: 'View business profile' },
  { key: 'business.update', description: 'Update business settings' },
  { key: 'profile.view', description: 'View own profile' },
  { key: 'profile.update', description: 'Update own profile' },
] as const;

function dedupePermissions(
  items: readonly { key: string; description: string }[]
) {
  const map = new Map<string, { key: string; description: string }>();
  for (const item of items) {
    map.set(item.key, item);
  }
  return Array.from(map.values());
}

export const ALL_PERMISSIONS = dedupePermissions([
  ...OWNER_MANAGER_PERMISSIONS,
  ...ADMINISTRATOR_PERMISSIONS,
]);

export type PermissionKey = (typeof ALL_PERMISSIONS)[number]['key'];

export const ROLE_OWNER_MANAGER = 'OWNER_MANAGER';
export const ROLE_ADMINISTRATOR = 'ADMINISTRATOR';
