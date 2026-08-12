import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { mediaUrl } from '../../lib/api';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import './Sidebar.css';

type NavItem = {
  to: string;
  label: string;
  end: boolean;
  icon: string;
  permission: string;
};

const navItems: NavItem[] = [
  { to: '/app', label: 'Dashboard', end: true, icon: '⌂', permission: 'dashboard.view' },
  {
    to: '/app/portal/purchases',
    label: 'My Purchases',
    end: true,
    icon: '$',
    permission: 'portal.purchases.view',
  },
  {
    to: '/app/portal/purchases/history',
    label: 'Purchase History',
    end: false,
    icon: '☰',
    permission: 'portal.purchases.history',
  },
  {
    to: '/app/portal/settings',
    label: 'Settings',
    end: false,
    icon: '⚙',
    permission: 'portal.settings.view',
  },
  {
    to: '/app/portal/products',
    label: 'Products Supplied',
    end: true,
    icon: '▦',
    permission: 'portal.products.view',
  },
  {
    to: '/app/portal/records',
    label: 'Purchase Records',
    end: true,
    icon: '$',
    permission: 'portal.records.view',
  },
  {
    to: '/app/portal/records/history',
    label: 'Purchase History',
    end: false,
    icon: '☰',
    permission: 'portal.history.view',
  },
  { to: '/app/users', label: 'Users', end: false, icon: '◌', permission: 'users.view' },
  {
    to: '/app/roles',
    label: 'Roles & Permissions',
    end: false,
    icon: '◈',
    permission: 'roles.view',
  },
  {
    to: '/app/activity-log',
    label: 'Activity Log',
    end: false,
    icon: '☰',
    permission: 'audit.view',
  },
  {
    to: '/app/business-settings',
    label: 'Business Settings',
    end: false,
    icon: '⚙',
    permission: 'business.update',
  },
  {
    to: '/app/analytics/business',
    label: 'Business Analytics',
    end: false,
    icon: '◫',
    permission: 'analytics.view',
  },
  {
    to: '/app/analytics/sales',
    label: 'Sales Analytics',
    end: false,
    icon: '▥',
    permission: 'analytics.view',
  },
  {
    to: '/app/analytics/inventory',
    label: 'Inventory Analytics',
    end: false,
    icon: '▤',
    permission: 'analytics.view',
  },
  {
    to: '/app/analytics/customers',
    label: 'Customer Analytics',
    end: false,
    icon: '◉',
    permission: 'analytics.view',
  },
  {
    to: '/app/forecasting',
    label: 'Forecasting',
    end: false,
    icon: '↗',
    permission: 'forecasting.view',
  },
  {
    to: '/app/recommendations',
    label: 'Recommendations',
    end: false,
    icon: '✦',
    permission: 'recommendations.view',
  },
  { to: '/app/reports', label: 'Reports', end: false, icon: '⎙', permission: 'reports.view' },
  { to: '/app/sales', label: 'Sales', end: true, icon: '$', permission: 'sales.view' },
  { to: '/app/sales/new', label: 'New Sale', end: false, icon: '↑', permission: 'sales.create' },
  { to: '/app/sales/history', label: 'Sales History', end: false, icon: '☰', permission: 'sales.view' },
  { to: '/app/expenses', label: 'Expenses', end: false, icon: '−', permission: 'expenses.view' },
  { to: '/app/products', label: 'Products', end: false, icon: '▦', permission: 'products.view' },
  {
    to: '/app/inventory',
    label: 'Inventory',
    end: true,
    icon: '▤',
    permission: 'inventory.view',
  },
  {
    to: '/app/inventory/stock-in',
    label: 'Stock In',
    end: false,
    icon: '+',
    permission: 'inventory.adjust',
  },
  {
    to: '/app/inventory/stock-out',
    label: 'Stock Out',
    end: false,
    icon: '−',
    permission: 'inventory.adjust',
  },
  {
    to: '/app/inventory/movements',
    label: 'Inventory Movement',
    end: false,
    icon: '☰',
    permission: 'inventory.view',
  },
  {
    to: '/app/customers',
    label: 'Customers',
    end: false,
    icon: '◉',
    permission: 'customers.view',
  },
  {
    to: '/app/suppliers',
    label: 'Suppliers',
    end: false,
    icon: '◎',
    permission: 'suppliers.view',
  },
  { to: '/app/profile', label: 'Profile', end: false, icon: '☺', permission: 'profile.view' },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: Props) {
  const { user, logout, hasPermission } = useAuth();
  const { pushToast } = useToast();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();
  const avatarSrc = mediaUrl(user?.avatarUrl);

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => hasPermission(item.permission)),
    [hasPermission]
  );

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      pushToast('Signed out.', 'success');
    } catch {
      pushToast('Signed out locally.', 'info');
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  }

  return (
    <div className="sidebar-root">
      <div
        className={`sidebar-backdrop ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div className={`sidebar-shell ${open ? 'is-open' : ''}`}>
        <nav className="sidebar-rail" aria-label="Quick navigation">
          {hasPermission('dashboard.view') ? (
            <NavLink
              to="/app"
              end
              className={({ isActive }) =>
                `sidebar-rail__link ${isActive ? 'is-active' : ''}`
              }
              onClick={onClose}
              aria-label="Dashboard"
            >
              ⌂
            </NavLink>
          ) : null}
          {hasPermission('profile.view') ? (
            <NavLink
              to="/app/profile"
              className={({ isActive }) =>
                `sidebar-rail__link ${isActive ? 'is-active' : ''}`
              }
              onClick={onClose}
              aria-label="Profile"
            >
              ☺
            </NavLink>
          ) : null}
        </nav>

        <aside className="sidebar">
        <div className="sidebar__profile">
          <div className="sidebar__avatar" aria-hidden="true">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="sidebar__avatar-image" />
            ) : (
              initials || 'U'
            )}
          </div>
          <div>
            <p className="sidebar__name">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="sidebar__meta">{user?.business.name}</p>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Primary">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'is-active' : ''}`
              }
              onClick={onClose}
            >
              <span className="sidebar__icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button
            type="button"
            className="sidebar__link sidebar__button"
            onClick={() => setConfirmLogout(true)}
          >
            <span className="sidebar__icon">⎋</span>
            Log out
          </button>
        </div>
      </aside>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        confirmLabel="Log out"
        danger
        loading={loggingOut}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => void handleLogout()}
      >
        You will need to sign in again to access your business workspace.
      </ConfirmDialog>
    </div>
  );
}
