import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import './AppShell.css';
import './Header.css';
import '../../pages/app-pages.css';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="app-shell__main">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <div className="app-shell__content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
