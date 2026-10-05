import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AppShell.css';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// SVG Icons (inline, consistent stroke style)
const icons = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  cart: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  list: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  history: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 106 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>,
  box: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  warehouse: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 8.35V20a2 2 0 01-2 2H4a2 2 0 01-2-2V8.35A2 2 0 013.26 6.5l8-3.2a2 2 0 011.48 0l8 3.2A2 2 0 0122 8.35z"/><path d="M6 18h12"/><path d="M6 14h12"/></svg>,
  users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  truck: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  receipt: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>,
  chart: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  trendUp: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  package: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  userCheck: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>,
  brain: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 00-4 4v1a4 4 0 00-3 7 4 4 0 003 7v1a4 4 0 008 0v-1a4 4 0 003-7 4 4 0 00-3-7V6a4 4 0 00-4-4z"/></svg>,
  lightbulb: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12c1 1 2 2 2 4h4c0-2 1-3 2-4a7 7 0 00-4-12z"/></svg>,
  fileText: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  activity: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  menu: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  logout: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chevronRight: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
};

// Navigation sections grouped by business function
const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/app', label: 'Dashboard', icon: icons.dashboard, end: true },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/app/sales/new', label: 'New Sale', icon: icons.plus },
      { to: '/app/sales', label: 'Sales', icon: icons.cart },
      { to: '/app/sales/history', label: 'Sales History', icon: icons.history },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/app/products', label: 'Products', icon: icons.box },
      { to: '/app/inventory', label: 'Inventory', icon: icons.warehouse },
      { to: '/app/customers', label: 'Customers', icon: icons.users },
      { to: '/app/suppliers', label: 'Suppliers', icon: icons.truck },
      { to: '/app/expenses', label: 'Expenses', icon: icons.receipt },
    ],
  },
  {
    title: 'Business Intelligence',
    items: [
      { to: '/app/analytics/business', label: 'Business Analytics', icon: icons.chart },
      { to: '/app/analytics/sales', label: 'Sales Analytics', icon: icons.trendUp },
      { to: '/app/analytics/inventory', label: 'Inventory Analytics', icon: icons.package },
      { to: '/app/analytics/customers', label: 'Customer Analytics', icon: icons.userCheck },
    ],
  },
  {
    title: 'Decision Support',
    items: [
      { to: '/app/forecasting', label: 'Forecasting', icon: icons.brain },
      { to: '/app/recommendations', label: 'Recommendations', icon: icons.lightbulb },
      { to: '/app/reports', label: 'Reports', icon: icons.fileText },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/app/users', label: 'Users', icon: icons.users },
      { to: '/app/roles', label: 'Roles & Permissions', icon: icons.shield },
      { to: '/app/activity-log', label: 'Activity Log', icon: icons.activity },
      { to: '/app/business-settings', label: 'Business Settings', icon: icons.settings },
    ],
  },
];

// Map routes to human-readable section/page names for the header
const ROUTE_LABELS: Record<string, { section: string; page: string }> = {
  '/app': { section: 'Overview', page: 'Dashboard' },
  '/app/sales/new': { section: 'Sales', page: 'New Sale' },
  '/app/sales': { section: 'Sales', page: 'Sales' },
  '/app/sales/history': { section: 'Sales', page: 'Sales History' },
  '/app/products': { section: 'Operations', page: 'Products' },
  '/app/inventory': { section: 'Operations', page: 'Inventory' },
  '/app/inventory/stock-in': { section: 'Operations', page: 'Stock In' },
  '/app/inventory/stock-out': { section: 'Operations', page: 'Stock Out' },
  '/app/inventory/movements': { section: 'Operations', page: 'Stock Movements' },
  '/app/customers': { section: 'Operations', page: 'Customers' },
  '/app/suppliers': { section: 'Operations', page: 'Suppliers' },
  '/app/expenses': { section: 'Operations', page: 'Expenses' },
  '/app/analytics/business': { section: 'Business Intelligence', page: 'Business Analytics' },
  '/app/analytics/sales': { section: 'Business Intelligence', page: 'Sales Analytics' },
  '/app/analytics/inventory': { section: 'Business Intelligence', page: 'Inventory Analytics' },
  '/app/analytics/customers': { section: 'Business Intelligence', page: 'Customer Analytics' },
  '/app/forecasting': { section: 'Decision Support', page: 'Forecasting' },
  '/app/recommendations': { section: 'Decision Support', page: 'Recommendations' },
  '/app/reports': { section: 'Decision Support', page: 'Reports' },
  '/app/users': { section: 'Administration', page: 'Users' },
  '/app/roles': { section: 'Administration', page: 'Roles & Permissions' },
  '/app/activity-log': { section: 'Administration', page: 'Activity Log' },
  '/app/business-settings': { section: 'Administration', page: 'Business Settings' },
  '/app/profile': { section: 'Account', page: 'Profile' },
};

function getRouteLabel(pathname: string): { section: string; page: string } {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  if (pathname.startsWith('/app/users/')) {
    return { section: 'Administration', page: 'User Details' };
  }
  return { section: '', page: '' };
}

function getUserDisplayName(user: any): string {
  return user?.email || 'User';
}

function getUserRoles(user: any): string {
  if (!user?.roles) return 'Member';
  if (Array.isArray(user.roles)) {
    return user.roles.map((r: any) => r.role_name || r.name || r).join(', ');
  }
  return 'Member';
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { section, page } = getRouteLabel(location.pathname);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function getInitials(email?: string) {
    if (!email) return 'U';
    const username = email.split('@')[0];
    return username.slice(0, 2).toUpperCase();
  }

  return (
    <div className="app-shell">
      {mobileOpen && (
        <div
          className="app-shell__overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <div className="sidebar__brand-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 14l4-4 4 4 5-5" />
            </svg>
          </div>
          <div className="sidebar__brand-text">
            <div className="sidebar__brand-name">SME Intelligence</div>
            <div className="sidebar__brand-sub">Business Platform</div>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Main navigation">
          {NAV_SECTIONS.map((navSection) => (
            <div key={navSection.title} className="sidebar__section">
              <div className="sidebar__section-title">{navSection.title}</div>
              <ul className="sidebar__list">
                {navSection.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                      }
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="sidebar__link-icon">{item.icon}</span>
                      <span className="sidebar__link-label">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <NavLink
            to="/app/profile"
            className={({ isActive }) =>
              `sidebar__profile ${isActive ? 'sidebar__profile--active' : ''}`
            }
            onClick={() => setMobileOpen(false)}
          >
            <div className="sidebar__avatar">{getInitials(user?.email)}</div>
            <div className="sidebar__profile-info">
              <div className="sidebar__profile-name">{getUserDisplayName(user)}</div>
              <div className="sidebar__profile-email">{user?.email || ''}</div>
            </div>
          </NavLink>
          <button
            type="button"
            className="sidebar__logout"
            onClick={handleLogout}
            title="Sign out"
          >
            {icons.logout}
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="app-shell__main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            {icons.menu}
          </button>

          <div className="topbar__breadcrumb">
            {section && (
              <>
                <span className="topbar__breadcrumb-section">{section}</span>
                <span className="topbar__breadcrumb-sep">{icons.chevronRight}</span>
              </>
            )}
            <span className="topbar__breadcrumb-page">{page}</span>
          </div>

          <div className="topbar__actions">
            <div className="topbar__user-chip">
              <div className="topbar__user-avatar">{getInitials(user?.email)}</div>
              <div className="topbar__user-info">
                <div className="topbar__user-name">{getUserDisplayName(user)}</div>
                <div className="topbar__user-role">{getUserRoles(user)}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}