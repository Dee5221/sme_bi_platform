import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import { downloadCsv } from '../lib/csv';
import * as reportsApi from '../services/reportsService';
import type { ReportData } from '../services/reportsService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import './BusinessAnalyticsPage.css';
import './ReportsPage.css';

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function monthStartIso(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('reports.view');
  const [startDate, setStartDate] = useState(monthStartIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setError('You do not have permission to view reports.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await reportsApi.fetchReport(startDate, endDate);
        if (active) {
          setReport(result.report);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof ApiClientError ? err.message : 'Unable to load report.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canView, startDate, endDate]);

  const netTone = useMemo(() => {
    if (!report) return 'green';
    return report.summary.netResult >= 0 ? 'green' : 'orange';
  }, [report]);

  if (!canView) {
    return <Alert tone="error">You do not have permission to view reports.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={10} />
      </Card>
    );
  }

  if (error || !report) {
    return <Alert tone="error">{error || 'Report unavailable.'}</Alert>;
  }

  const { summary, sales, expenses, inventory, topProducts, business, period } = report;

  return (
    <div className="business-analytics-page reports-page">
      <PageHeader
        title="Reports"
        subtitle={`${business.name} · ${period.label}`}
        actions={
          <div className="reports-filters">
            <Input
              label="Start date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <Input
              label="End date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        }
      />

      <div className="reports-presets">
        <Button variant="secondary" onClick={() => { setStartDate(monthStartIso()); setEndDate(todayIso()); }}>
          This month
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            setStartDate(start.toISOString().slice(0, 10));
            setEndDate(end.toISOString().slice(0, 10));
          }}
        >
          Last month
        </Button>
        <Button variant="secondary" onClick={() => { setStartDate(daysAgoIso(89)); setEndDate(todayIso()); }}>
          Last 90 days
        </Button>
      </div>

      <section className="analytics-kpi-grid" aria-label="Report summary">
        <article className="analytics-kpi analytics-kpi--revenue">
          <p>Revenue</p>
          <h2>{formatMoney(summary.totalRevenue)}</h2>
          <span>{summary.salesCount} sales</span>
        </article>
        <article className="analytics-kpi analytics-kpi--expense">
          <p>Expenses</p>
          <h2>{formatMoney(summary.totalExpenses)}</h2>
          <span>{summary.expenseCount} records</span>
        </article>
        <article className="analytics-kpi analytics-kpi--net">
          <p>Net result</p>
          <h2>{formatMoney(summary.netResult)}</h2>
          <Badge tone={netTone}>{summary.netResult >= 0 ? 'Surplus' : 'Deficit'}</Badge>
        </article>
        <article className="analytics-kpi analytics-kpi--context">
          <p>Inventory snapshot</p>
          <ul className="analytics-context-list">
            <li>{summary.trackedProducts} products tracked</li>
            <li>{summary.totalUnitsOnHand} units on hand</li>
            <li>{formatMoney(summary.inventoryValue)} value · {summary.lowStockCount} low stock</li>
          </ul>
        </article>
      </section>

      <div className="reports-sections">
        <Card
          title="Sales report"
          action={
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `sales-report-${startDate}-to-${endDate}.csv`,
                  ['Sale #', 'Date', 'Customer', 'Items', 'Total'],
                  sales.rows.map((row) => [
                    row.saleNumber,
                    formatDate(row.soldAt),
                    row.customerName,
                    row.itemCount,
                    row.total,
                  ])
                )
              }
            >
              Download CSV
            </Button>
          }
        >
          <p className="reports-section-summary">
            {sales.count} sale{sales.count === 1 ? '' : 's'} · {formatMoney(sales.totalAmount)} total
          </p>
          <DataTable
            columns={[
              { key: 'saleNumber', header: 'Sale #', render: (row) => row.saleNumber },
              { key: 'soldAt', header: 'Date', render: (row) => formatDate(row.soldAt) },
              { key: 'customer', header: 'Customer', render: (row) => row.customerName },
              { key: 'items', header: 'Items', render: (row) => row.itemCount },
              { key: 'total', header: 'Total', render: (row) => formatMoney(row.total) },
            ]}
            rows={sales.rows}
            rowKey={(row) => row.id}
            emptyTitle="No sales in this period"
            emptyDescription="Adjust the date range or record sales to populate this report."
          />
        </Card>

        <Card
          title="Expenses report"
          action={
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `expenses-report-${startDate}-to-${endDate}.csv`,
                  ['Title', 'Date', 'Category', 'Amount'],
                  expenses.rows.map((row) => [
                    row.title,
                    formatDate(row.expenseDate),
                    row.categoryName,
                    row.amount,
                  ])
                )
              }
            >
              Download CSV
            </Button>
          }
        >
          <p className="reports-section-summary">
            {expenses.count} expense{expenses.count === 1 ? '' : 's'} · {formatMoney(expenses.totalAmount)} total
          </p>
          <DataTable
            columns={[
              { key: 'title', header: 'Title', render: (row) => row.title },
              { key: 'date', header: 'Date', render: (row) => formatDate(row.expenseDate) },
              { key: 'category', header: 'Category', render: (row) => row.categoryName },
              { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
            ]}
            rows={expenses.rows}
            rowKey={(row) => row.id}
            emptyTitle="No expenses in this period"
            emptyDescription="Adjust the date range or record expenses to populate this report."
          />
          {expenses.byCategory.length > 0 && (
            <ul className="analytics-rank-list">
              {expenses.byCategory.map((row) => (
                <li key={row.categoryName}>
                  <span>•</span>
                  <div>
                    <strong>{row.categoryName}</strong>
                    <span>{formatMoney(row.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Inventory snapshot"
          action={
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `inventory-report-${endDate}.csv`,
                  ['Product', 'SKU', 'Qty', 'Threshold', 'Unit price', 'Value', 'Low stock'],
                  inventory.rows.map((row) => [
                    row.productName,
                    row.sku,
                    row.quantity,
                    row.lowStockThreshold,
                    row.unitPrice,
                    row.inventoryValue,
                    row.isLowStock ? 'Yes' : 'No',
                  ])
                )
              }
            >
              Download CSV
            </Button>
          }
        >
          <p className="reports-section-summary">
            {inventory.totalUnits} units · {formatMoney(inventory.totalValue)} value ·{' '}
            {inventory.lowStockCount} low-stock item{inventory.lowStockCount === 1 ? '' : 's'}
          </p>
          <DataTable
            columns={[
              { key: 'product', header: 'Product', render: (row) => row.productName },
              { key: 'sku', header: 'SKU', render: (row) => row.sku },
              { key: 'qty', header: 'Qty', render: (row) => row.quantity },
              { key: 'threshold', header: 'Threshold', render: (row) => row.lowStockThreshold },
              { key: 'value', header: 'Value', render: (row) => formatMoney(row.inventoryValue) },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={row.isLowStock ? 'orange' : 'green'}>
                    {row.isLowStock ? 'Low stock' : 'Healthy'}
                  </Badge>
                ),
              },
            ]}
            rows={inventory.rows}
            rowKey={(row) => row.productId}
            emptyTitle="No inventory tracked"
            emptyDescription="Add products to include them in the inventory snapshot."
          />
        </Card>

        <Card title="Top products in period">
          <DataTable
            columns={[
              { key: 'product', header: 'Product', render: (row) => row.productName },
              { key: 'sku', header: 'SKU', render: (row) => row.productSku },
              { key: 'units', header: 'Units sold', render: (row) => row.quantity },
              { key: 'revenue', header: 'Revenue', render: (row) => formatMoney(row.revenue) },
            ]}
            rows={topProducts}
            rowKey={(row) => row.productId}
            emptyTitle="No product sales in this period"
            emptyDescription="Sales line items in the selected range will appear here."
          />
        </Card>
      </div>
    </div>
  );
}
