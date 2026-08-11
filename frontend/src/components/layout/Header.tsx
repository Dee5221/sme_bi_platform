type Props = {
  onMenuClick: () => void;
  searchPlaceholder?: string;
};

export function Header({ onMenuClick, searchPlaceholder = 'Search' }: Props) {
  return (
    <div className="app-header">
      <button type="button" className="app-header__menu" onClick={onMenuClick} aria-label="Open menu">
        ☰
      </button>
      <label className="app-header__search">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder={searchPlaceholder} disabled />
      </label>
    </div>
  );
}
