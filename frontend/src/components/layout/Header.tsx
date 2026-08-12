import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { mediaUrl } from '../../lib/api';

type Props = {
  onMenuClick: () => void;
  searchPlaceholder?: string;
};

export function Header({ onMenuClick, searchPlaceholder = 'Search here...' }: Props) {
  const { user, hasPermission } = useAuth();
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();
  const canQuickAdd = hasPermission('sales.create');
  const avatarSrc = mediaUrl(user?.avatarUrl);

  return (
    <header className="app-header">
      <div className="app-header__left">
        <button
          type="button"
          className="app-header__menu"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          ☰
        </button>
        <Link to="/app" className="app-header__brand">
          SME Intelligence<span className="app-header__brand-dot">.</span>
        </Link>
      </div>

      <label className="app-header__search">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder={searchPlaceholder} disabled />
      </label>

      <div className="app-header__actions">
        <button type="button" className="app-header__icon-btn" aria-label="Notifications" disabled>
          🔔
        </button>
        <Link to="/app/profile" className="app-header__profile" aria-label="Profile">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="app-header__avatar app-header__avatar--image" />
          ) : (
            <span className="app-header__avatar">{initials || 'U'}</span>
          )}
        </Link>
        {canQuickAdd ? (
          <Link
            to="/app/sales/new"
            className="app-header__icon-btn app-header__icon-btn--add"
            aria-label="Quick add"
          >
            +
          </Link>
        ) : null}
      </div>
    </header>
  );
}
