import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { BusinessAnalyticsPage } from './pages/BusinessAnalyticsPage';
import { BusinessSettingsPage } from './pages/BusinessSettingsPage';
import { CustomerAnalyticsPage } from './pages/CustomerAnalyticsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ForecastingPage } from './pages/ForecastingPage';
import { InventoryAnalyticsPage } from './pages/InventoryAnalyticsPage';
import { InventoryMovementPage } from './pages/InventoryMovementPage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { NewSalePage } from './pages/NewSalePage';
import { ProductsPage } from './pages/ProductsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { RolesPermissionsPage } from './pages/RolesPermissionsPage';
import { SalesAnalyticsPage } from './pages/SalesAnalyticsPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { SalesPage } from './pages/SalesPage';
import { StockInPage } from './pages/StockInPage';
import { StockOutPage } from './pages/StockOutPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { UserDetailsPage } from './pages/UserDetailsPage';
import { UsersPage } from './pages/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="access-denied" element={<AccessDeniedPage />} />

          <Route element={<ProtectedRoute permission="sales.create" />}>
            <Route path="sales/new" element={<NewSalePage />} />
          </Route>
          <Route element={<ProtectedRoute anyOf={['sales.view_own', 'sales.view_all']} />}>
            <Route path="sales/history" element={<SalesHistoryPage />} />
            <Route path="sales" element={<SalesPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="products.view" />}>
            <Route path="products" element={<ProductsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="products.manage" />}>
            <Route path="categories" element={<CategoriesPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="inventory.manage" />}>
            <Route path="inventory/stock-in" element={<StockInPage />} />
            <Route path="inventory/stock-out" element={<StockOutPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="inventory.view" />}>
            <Route path="inventory/movements" element={<InventoryMovementPage />} />
            <Route path="inventory" element={<InventoryPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="customers.view" />}>
            <Route path="customers" element={<CustomersPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="suppliers.view" />}>
            <Route path="suppliers" element={<SuppliersPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="expenses.view" />}>
            <Route path="expenses" element={<ExpensesPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="analytics.view" />}>
            <Route path="analytics/business" element={<BusinessAnalyticsPage />} />
            <Route path="analytics/sales" element={<SalesAnalyticsPage />} />
            <Route path="analytics/inventory" element={<InventoryAnalyticsPage />} />
            <Route path="analytics/customers" element={<CustomerAnalyticsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="forecasting.view" />}>
            <Route path="forecasting" element={<ForecastingPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="recommendations.view" />}>
            <Route path="recommendations" element={<RecommendationsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="reports.generate" />}>
            <Route path="reports" element={<ReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="users.view" />}>
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="roles.view" />}>
            <Route path="roles" element={<RolesPermissionsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="audit.view" />}>
            <Route path="activity-log" element={<ActivityLogPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="business.settings.manage" />}>
            <Route path="business-settings" element={<BusinessSettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
