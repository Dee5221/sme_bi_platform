import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  { to: '/app/users', label: 'Users', end: false, icon: '◌', permission: 'users.view' },
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
  { to: '/app/sales', label: 'Sales', end: false, icon: '$', permission: 'sales.view' },
  { to: '/app/expenses', label: 'Expenses', end: false, icon: '−', permission: 'expenses.view' },
  { to: '/app/products', label: 'Products', end: false, icon: '▦', permission: 'products.view' },
  {
    to: '/app/inventory',
    label: 'Inventory',
    end: false,
    icon: '▤',
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
    <>
      <div
        className={`sidebar-backdrop ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar__profile">
          <div className="sidebar__avatar" aria-hidden="true">
            {initials || 'U'}
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
    </>
  );
}
