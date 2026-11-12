import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as analyticsApi from '../services/analyticsService';
import type {
  ProfitabilityResponse,
  SalesTrendPoint,
  SummaryResponse,
  TopProductItem,
} from '../services/analyticsService';
import * as recommendationsApi from '../services/recommendationsService';
import type { RecommendationsResponse } from '../services/recommendationsService';
import * as forecastingApi from '../services/forecastingService';
import type { ForecastingData } from '../services/forecastingService';
import * as saleService from '../services/saleService';
import type { SaleListItem } from '../services/saleService';
import * as productApi from '../services/productService';
import type { Product } from '../services/productService';
import * as inventoryApi from '../services/inventoryService';
import type { InventoryItem } from '../services/inventoryService';
import * as expenseApi from '../services/expenseService';
import type { Expense } from '../services/expenseService';
import { Card } from '../components/ui/Card';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import './dashboard.css';

function formatCurrency(amount: number): string {
  return `K${amount.toLocaleString('en-ZM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const weekday = copy.getDay();
  const diff = weekday === 0 ? 6 : weekday - 1;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatSaleTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-ZM', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  });
}

function ProfitCard({ data }: { data: ProfitabilityResponse | null }) {
  return (
    <Card className="dashboard-card">
      <div className="dashboard-card-header">
        <h2 className="dashboard-card-title">Gross profit</h2>
      </div>
      <div className="dashboard-card-body">
        {!data || !data.available ? (
          <div className="dashboard-empty-state">Profit data unavailable.</div>
        ) : (
          <>
            <div className="dashboard-kpi-value">{formatCurrency(data.gross_profit || 0)}</div>
            <div className="dashboard-kpi-trend">
              {data.gross_margin_pct == null ? 'Margin n/a' : `${data.gross_margin_pct}% margin`}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function LowStockList({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) {
    return <div className="dashboard-empty-state">No low-stock items right now.</div>;
  }
  return (
    <div className="dashboard-alert-list">
      {items.slice(0, 6).map((item) => (
        <div key={item.product_id} className="dashboard-alert-item">
          <div className="dashboard-alert-item-content">
            <div className="dashboard-alert-item-name">{item.product_name}</div>
            <div className="dashboard-alert-item-meta">
              {item.sku} · {item.quantity_on_hand} on hand · reorder {item.reorder_level}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TopProductsTable({ items, showRevenue }: { items: TopProductItem[]; showRevenue: boolean }) {
  if (items.length === 0) {
    return <div className="dashboard-empty-state">No completed sales in this period.</div>;
  }
  return (
    <div className="dashboard-table-wrapper">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Product</th>
            <th className="dashboard-table-th--right">Units</th>
            {showRevenue ? <th className="dashboard-table-th--right">Revenue</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.product_id}>
              <td>
                <div className="dashboard-table-td--bold">{item.product_name}</div>
                <div className="dashboard-table-td--muted">{item.sku}</div>
              </td>
              <td className="dashboard-table-td--right">{item.units_sold}</td>
              {showRevenue ? (
                <td className="dashboard-table-td--right dashboard-table-td--bold">
                  {formatCurrency(item.revenue)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendBars({ points }: { points: SalesTrendPoint[] }) {
  if (points.length === 0) {
    return <div className="dashboard-empty-state">No trend data for this period.</div>;
  }
  const max = Math.max(...points.map((point) => point.revenue), 1);
  return (
    <div className="dashboard-trend">
      <div className="dashboard-trend-bars">
        {points.map((point) => (
          <div key={point.period} className="dashboard-trend-col">
            <div
              className="dashboard-trend-bar"
              style={{ height: `${Math.max(8, (point.revenue / max) * 100)}%` }}
              title={`${point.period}: ${formatCurrency(point.revenue)}`}
            />
            <div className="dashboard-trend-label">{point.period.slice(-5)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffDashboard() {
  const { user, hasPermission } = useAuth();
  const canCreateSale = hasPermission('sales.create');
  const today = isoDate(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todaySales, setTodaySales] = useState<SaleListItem[]>([]);
  const [recentSales, setRecentSales] = useState<SaleListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lookup, setLookup] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [ownToday, ownRecent, productResult, inventoryResult] = await Promise.all([
          saleService.listSales({ start_date: today, end_date: today, status_filter: 'completed' }),
          saleService.listSales({ status_filter: 'completed' }),
          productApi.listProducts({ status: 'ACTIVE', page: 1, pageSize: 200 }),
          inventoryApi.listInventory({ lowStockOnly: false }),
        ]);
        if (!active) return;
        const todayItems = Array.isArray(ownToday) ? ownToday : [];
        const recentItems = (Array.isArray(ownRecent) ? ownRecent : [])
          .slice()
          .sort((a, b) => new Date(b.sale_datetime).getTime() - new Date(a.sale_datetime).getTime())
          .slice(0, 5);
        setTodaySales(todayItems);
        setRecentSales(recentItems);
        setProducts(productResult.items);
        setInventory(inventoryResult.items);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load your sales overview.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [today]);

  const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
  const lowStock = inventory.filter(
    (item) => item.stock_status === 'low_stock' || item.stock_status === 'out_of_stock'
  );
  const inventoryByProduct = useMemo(() => {
    const map = new Map<number, InventoryItem>();
    for (const item of inventory) map.set(item.product_id, item);
    return map;
  }, [inventory]);

  const lookupResults = useMemo(() => {
    const query = lookup.trim().toLowerCase();
    if (query.length < 2) return [];
    return products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [lookup, products]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">My Sales Overview</h1>
            <p className="dashboard-subtitle">Welcome back, {user?.name || user?.email || 'User'}</p>
          </div>
        </div>
        <LoadingSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">My Sales Overview</h1>
          <p className="dashboard-subtitle">
            Welcome back, {user?.name || user?.email || 'User'}. Only sales you recorded are shown
            here.
          </p>
        </div>
        {canCreateSale ? (
          <Link to="/app/sales/new">
            <Button>New Sale</Button>
          </Link>
        ) : null}
      </div>

      <div className="dashboard-kpi-grid">
        <Card className="dashboard-kpi-card">
          <div className="dashboard-kpi-label">Sales I recorded today</div>
          <div className="dashboard-kpi-value">{todaySales.length}</div>
          <div className="dashboard-kpi-trend">Completed transactions</div>
        </Card>
        <Card className="dashboard-kpi-card">
          <div className="dashboard-kpi-label">Today&apos;s total</div>
          <div className="dashboard-kpi-value">{formatCurrency(todayTotal)}</div>
          <div className="dashboard-kpi-trend">From your completed sales</div>
        </Card>
        <Card className="dashboard-kpi-card">
          <div className="dashboard-kpi-label">Stock alerts</div>
          <div className={`dashboard-kpi-value ${lowStock.length > 0 ? 'text-warning' : ''}`}>
            {lowStock.length}
          </div>
          <div className="dashboard-kpi-trend">
            {lowStock.length > 0 ? 'Needs restock' : 'None below reorder level'}
          </div>
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card className="dashboard-card dashboard-card--wide">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">Recent sales</h2>
            <Link to="/app/sales/history" className="dashboard-card-link">
              My sales history
            </Link>
          </div>
          <div className="dashboard-card-body">
            {recentSales.length === 0 ? (
              <div className="dashboard-empty-state">You have not recorded any sales yet.</div>
            ) : (
              <div className="dashboard-table-wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Customer</th>
                      <th className="dashboard-table-th--right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((sale) => (
                      <tr key={sale.id}>
                        <td>{formatSaleTime(sale.sale_datetime)}</td>
                        <td>{sale.customer_name || 'Walk-in'}</td>
                        <td className="dashboard-table-td--right dashboard-table-td--bold">
                          {formatCurrency(Number(sale.total_amount || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <Card className="dashboard-card">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">Product lookup</h2>
            <Link to="/app/products" className="dashboard-card-link">
              Open catalog
            </Link>
          </div>
          <div className="dashboard-card-body dashboard-lookup">
            <Input
              label="Search products"
              name="product-lookup"
              placeholder="Type a name or SKU"
              value={lookup}
              onChange={(event) => setLookup(event.target.value)}
            />
            {lookup.trim().length < 2 ? (
              <div className="dashboard-empty-state">Type at least 2 characters to look up stock.</div>
            ) : lookupResults.length === 0 ? (
              <div className="dashboard-empty-state">No matching products.</div>
            ) : (
              <div className="dashboard-alert-list">
                {lookupResults.map((product) => {
                  const stock = inventoryByProduct.get(product.id);
                  return (
                    <div key={product.id} className="dashboard-alert-item">
                      <div className="dashboard-alert-item-content">
                        <div className="dashboard-alert-item-name">{product.name}</div>
                        <div className="dashboard-alert-item-meta">
                          {product.sku} · {formatCurrency(Number(product.selling_price || 0))} ·{' '}
                          {stock ? `${stock.quantity_on_hand} on hand` : 'stock unavailable'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="dashboard-card">
        <div className="dashboard-card-header">
          <h2 className="dashboard-card-title">Low stock notifications</h2>
        </div>
        <div className="dashboard-card-body">
          <LowStockList items={lowStock} />
        </div>
      </Card>
    </div>
  );
}

function ManagementDashboard({ isOwner }: { isOwner: boolean }) {
  const { user, hasPermission } = useAuth();
  const canViewRecommendations = hasPermission('recommendations.view');
  const canViewForecasting = hasPermission('forecasting.view');
  const canViewReports = hasPermission('reports.generate');
  const canViewExpenses = hasPermission('expenses.view');
  const canViewCosts = hasPermission('products.costs.view');
  const now = new Date();
  const today = isoDate(now);
  const weekStart = isoDate(startOfWeek(now));
  const monthStart = isoDate(startOfMonth(now));
  const trendStart = isoDate(addDays(now, isOwner ? -13 : -6));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthSummary, setMonthSummary] = useState<SummaryResponse | null>(null);
  const [todaySummary, setTodaySummary] = useState<SummaryResponse | null>(null);
  const [weekSummary, setWeekSummary] = useState<SummaryResponse | null>(null);
  const [trend, setTrend] = useState<SalesTrendPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [forecasting, setForecasting] = useState<ForecastingData | null>(null);
  const [profitability, setProfitability] = useState<ProfitabilityResponse | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [
          month,
          todayData,
          weekData,
          trendData,
          topData,
          inventoryResult,
          expenseData,
          recs,
          forecast,
          profit,
        ] = await Promise.all([
          analyticsApi.fetchSummary({ start_date: monthStart, end_date: today }),
          analyticsApi.fetchSummary({ start_date: today, end_date: today }),
          analyticsApi.fetchSummary({ start_date: weekStart, end_date: today }),
          analyticsApi.fetchSalesTrend({ start_date: trendStart, end_date: today, group_by: 'day' }),
          analyticsApi.fetchTopProducts({
            start_date: monthStart,
            end_date: today,
            limit: 5,
            sort_by: isOwner ? 'revenue' : 'units',
          }),
          inventoryApi.listInventory({ lowStockOnly: true }),
          canViewExpenses ? expenseApi.listExpenses() : Promise.resolve([] as Expense[]),
          canViewRecommendations
            ? recommendationsApi.fetchRecommendations({ months: 6 }).catch(() => null)
            : Promise.resolve(null),
          canViewForecasting
            ? forecastingApi
                .fetchForecasting(6, 3)
                .then((data) => data.forecasting)
                .catch(() => null)
            : Promise.resolve(null),
          canViewCosts
            ? analyticsApi
                .fetchProfitability({ start_date: monthStart, end_date: today })
                .catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!active) return;
        setMonthSummary(month);
        setTodaySummary(todayData);
        setWeekSummary(weekData);
        setTrend(trendData);
        setTopProducts(topData);
        setLowStock(inventoryResult.items);
        setExpenses(
          [...expenseData]
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
            .slice(0, 5)
        );
        setRecommendations(recs);
        setForecasting(forecast);
        setProfitability(profit);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load dashboard data.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    canViewCosts,
    canViewExpenses,
    canViewForecasting,
    canViewRecommendations,
    isOwner,
    monthStart,
    today,
    trendStart,
    weekStart,
  ]);

  const restock = (forecasting?.inventoryForecasts || [])
    .filter((item) => item.urgency === 'HIGH')
    .slice(0, 5);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">Welcome back, {user?.name || user?.email || 'User'}</p>
          </div>
        </div>
        <LoadingSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }

  const summary = isOwner ? monthSummary : weekSummary;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">{isOwner ? 'Owner Dashboard' : 'Manager Dashboard'}</h1>
          <p className="dashboard-subtitle">
            Welcome back, {user?.name || user?.email || 'User'}.{' '}
            {isOwner
              ? `Business overview for ${monthSummary?.period_start} to ${monthSummary?.period_end}.`
              : `Operations snapshot for ${weekStart} to ${today}.`}
          </p>
        </div>
        {canViewReports ? (
          <Link to="/app/reports">
            <Button>View Reports</Button>
          </Link>
        ) : null}
      </div>

      <div className="dashboard-kpi-grid">
        <Card className="dashboard-kpi-card">
          <div className="dashboard-kpi-label">Sales today</div>
          <div className="dashboard-kpi-value">{todaySummary?.total_transactions ?? 0}</div>
          <div className="dashboard-kpi-trend">
            {formatCurrency(todaySummary?.total_revenue ?? 0)} revenue
          </div>
        </Card>
        <Card className="dashboard-kpi-card">
          <div className="dashboard-kpi-label">Sales this week</div>
          <div className="dashboard-kpi-value">{weekSummary?.total_transactions ?? 0}</div>
          <div className="dashboard-kpi-trend">
            {formatCurrency(weekSummary?.total_revenue ?? 0)} revenue
          </div>
        </Card>
        {isOwner ? (
          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-label">Revenue this month</div>
            <div className="dashboard-kpi-value">
              {formatCurrency(monthSummary?.total_revenue ?? 0)}
            </div>
            <div className="dashboard-kpi-trend">Completed sales</div>
          </Card>
        ) : null}
        {isOwner ? (
          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-label">Net cash flow</div>
            <div
              className={`dashboard-kpi-value ${
                (summary?.net_cash_flow ?? 0) >= 0 ? 'text-success' : 'text-warning'
              }`}
            >
              {formatCurrency(summary?.net_cash_flow ?? 0)}
            </div>
            <div className="dashboard-kpi-trend">
              {(summary?.net_cash_flow ?? 0) >= 0 ? 'Revenue minus expenses' : 'Expenses exceed revenue'}
            </div>
          </Card>
        ) : (
          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-label">Expenses this week</div>
            <div className="dashboard-kpi-value">
              {formatCurrency(weekSummary?.total_expenses ?? 0)}
            </div>
            <div className="dashboard-kpi-trend">Recorded operating expenses</div>
          </Card>
        )}
        <Card className="dashboard-kpi-card">
          <div className="dashboard-kpi-label">Avg. order value</div>
          <div className="dashboard-kpi-value">{formatCurrency(summary?.aov ?? 0)}</div>
          <div className="dashboard-kpi-trend">{isOwner ? 'This month' : 'This week'}</div>
        </Card>
        <Card className="dashboard-kpi-card">
          <div className="dashboard-kpi-label">Low stock alerts</div>
          <div className={`dashboard-kpi-value ${lowStock.length > 0 ? 'text-warning' : ''}`}>
            {lowStock.length}
          </div>
          <div className="dashboard-kpi-trend">
            {lowStock.length > 0 ? 'Needs restock' : 'None below reorder level'}
          </div>
        </Card>
        {canViewRecommendations ? (
          <Card className="dashboard-kpi-card">
            <div className="dashboard-kpi-label">Recommendations</div>
            <div className="dashboard-kpi-value">{recommendations?.total_recommendations ?? 0}</div>
            <div className="dashboard-kpi-trend">
              {recommendations?.summary.by_severity.CRITICAL
                ? `${recommendations.summary.by_severity.CRITICAL} critical`
                : 'No critical alerts'}
            </div>
            <Link to="/app/recommendations" className="dashboard-card-link">
              View all
            </Link>
          </Card>
        ) : null}
      </div>

      <div className="dashboard-grid">
        <Card className="dashboard-card dashboard-card--wide">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">{isOwner ? 'Daily sales (14 days)' : 'Daily sales (7 days)'}</h2>
            <Link to="/app/analytics/sales" className="dashboard-card-link">
              Sales analytics
            </Link>
          </div>
          <div className="dashboard-card-body">
            <TrendBars points={trend} />
          </div>
        </Card>

        <Card className="dashboard-card">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">
              {isOwner ? 'Top products' : 'Fast-moving products'}
            </h2>
          </div>
          <div className="dashboard-card-body">
            <TopProductsTable items={topProducts} showRevenue={isOwner} />
          </div>
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card className="dashboard-card">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">Low stock</h2>
            <Link to="/app/inventory/movements" className="dashboard-card-link">
              Stock movements
            </Link>
          </div>
          <div className="dashboard-card-body">
            <LowStockList items={lowStock} />
          </div>
        </Card>

        <Card className="dashboard-card">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">Restock suggestions</h2>
            {canViewForecasting ? (
              <Link to="/app/forecasting" className="dashboard-card-link">
                Forecasting
              </Link>
            ) : null}
          </div>
          <div className="dashboard-card-body">
            {restock.length === 0 ? (
              <div className="dashboard-empty-state">No high-urgency restock items.</div>
            ) : (
              <div className="dashboard-alert-list">
                {restock.map((item) => (
                  <div key={item.productId} className="dashboard-alert-item">
                    <div className="dashboard-alert-item-content">
                      <div className="dashboard-alert-item-name">{item.productName}</div>
                      <div className="dashboard-alert-item-meta">
                        {item.productSku} · suggest {item.suggestedRestockQuantity} ·{' '}
                        {item.estimatedDaysUntilStockout ?? '—'} days of cover
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {canViewExpenses ? (
          <Card className="dashboard-card">
            <div className="dashboard-card-header">
              <h2 className="dashboard-card-title">Recent expenses</h2>
              <Link to="/app/expenses" className="dashboard-card-link">
                Manage expenses
              </Link>
            </div>
            <div className="dashboard-card-body">
              {expenses.length === 0 ? (
                <div className="dashboard-empty-state">No expenses recorded.</div>
              ) : (
                <div className="dashboard-alert-list">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="dashboard-alert-item">
                      <div className="dashboard-alert-item-content">
                        <div className="dashboard-alert-item-name">{expense.description}</div>
                        <div className="dashboard-alert-item-meta">
                          {expense.date} · {expense.category}
                        </div>
                      </div>
                      <div className="dashboard-table-td--bold">{formatCurrency(expense.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ) : null}

        <ProfitCard data={profitability} />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { hasPermission } = useAuth();
  const canViewAnalytics = hasPermission('analytics.view');
  const isOwner = hasPermission('users.manage');

  if (!canViewAnalytics) {
    return <StaffDashboard />;
  }
  return <ManagementDashboard isOwner={isOwner} />;
}
