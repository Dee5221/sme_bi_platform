import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { BusinessAnalyticsPage } from './pages/BusinessAnalyticsPage';
import { BusinessSettingsPage } from './pages/BusinessSettingsPage';
import { CustomerAnalyticsPage } from './pages/CustomerAnalyticsPage';
import { PortalSettingsPage } from './pages/PortalSettingsPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ForecastingPage } from './pages/ForecastingPage';
import { InventoryAnalyticsPage } from './pages/InventoryAnalyticsPage';
import { InventoryMovementPage } from './pages/InventoryMovementPage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { MyPurchasesPage } from './pages/MyPurchasesPage';
import { NewSalePage } from './pages/NewSalePage';
import { ProductsSuppliedPage } from './pages/ProductsSuppliedPage';
import { ProductsPage } from './pages/ProductsPage';
import { PurchaseHistoryPage } from './pages/PurchaseHistoryPage';
import { PurchaseRecordsPage } from './pages/PurchaseRecordsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { RolesPermissionsPage } from './pages/RolesPermissionsPage';
import { SalesAnalyticsPage } from './pages/SalesAnalyticsPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { SalesPage } from './pages/SalesPage';
import { SupplierPurchaseHistoryPage } from './pages/SupplierPurchaseHistoryPage';
import { StockInPage } from './pages/StockInPage';
import { StockOutPage } from './pages/StockOutPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailsPage } from './pages/UserDetailsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="analytics/business" element={<BusinessAnalyticsPage />} />
          <Route path="analytics/sales" element={<SalesAnalyticsPage />} />
          <Route path="analytics/inventory" element={<InventoryAnalyticsPage />} />
          <Route path="analytics/customers" element={<CustomerAnalyticsPage />} />
          <Route path="forecasting" element={<ForecastingPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="portal/records/history" element={<SupplierPurchaseHistoryPage />} />
          <Route path="portal/records" element={<PurchaseRecordsPage />} />
          <Route path="portal/products" element={<ProductsSuppliedPage />} />
          <Route path="portal/settings" element={<PortalSettingsPage />} />
          <Route path="portal/purchases/history" element={<PurchaseHistoryPage />} />
          <Route path="portal/purchases" element={<MyPurchasesPage />} />
          <Route path="sales/new" element={<NewSalePage />} />
          <Route path="sales/history" element={<SalesHistoryPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="inventory/stock-in" element={<StockInPage />} />
          <Route path="inventory/stock-out" element={<StockOutPage />} />
          <Route path="inventory/movements" element={<InventoryMovementPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id" element={<UserDetailsPage />} />
          <Route path="roles" element={<RolesPermissionsPage />} />
          <Route path="activity-log" element={<ActivityLogPage />} />
          <Route path="business-settings" element={<BusinessSettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
