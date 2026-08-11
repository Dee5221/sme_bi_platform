import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import './Sidebar.css';

const navItems = [
  { to: '/app', label: 'Home', end: true, icon: '⌂' },
  { to: '/app/profile', label: 'Profile', end: false, icon: '☺' },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: Props) {
  const { user, logout } = useAuth();
  const { pushToast } = useToast();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

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
          {navItems.map((item) => (
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
