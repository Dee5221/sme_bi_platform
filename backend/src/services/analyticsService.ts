import { toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';

export type BusinessAnalyticsQuery = {
  months?: number;
};

type MonthBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

function clampMonths(months?: number) {
  if (!months || Number.isNaN(months)) return 6;
  return Math.min(12, Math.max(3, Math.floor(months)));
}

function buildMonthBuckets(months: number): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const now = new Date();
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    buckets.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: start.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      start,
      end,
    });
  }
  return buckets;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function getBusinessAnalytics(businessId: string, query: BusinessAnalyticsQuery) {
  const months = clampMonths(query.months);
  const buckets = buildMonthBuckets(months);
  const rangeStart = buckets[0]?.start ?? new Date();
  const rangeEnd = buckets[buckets.length - 1]?.end ?? new Date();

  const [sales, expenses, saleItems, expenseCategories, activeCustomers, activeProducts, inventories] =
    await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          status: 'COMPLETED',
          soldAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: { soldAt: true, total: true },
      }),
      prisma.expense.findMany({
        where: {
          businessId,
          status: 'ACTIVE',
          expenseDate: { gte: rangeStart, lte: rangeEnd },
        },
        select: { expenseDate: true, amount: true, categoryId: true },
      }),
      prisma.saleItem.findMany({
        where: {
          sale: {
            businessId,
            status: 'COMPLETED',
            soldAt: { gte: rangeStart, lte: rangeEnd },
          },
        },
        select: {
          productId: true,
          productName: true,
          productSku: true,
          quantity: true,
          lineTotal: true,
        },
      }),
      prisma.expenseCategory.findMany({
        where: { businessId },
        select: { id: true, name: true },
      }),
      prisma.customer.count({ where: { businessId, status: 'ACTIVE' } }),
      prisma.product.count({ where: { businessId, status: 'ACTIVE' } }),
      prisma.inventory.findMany({
        where: {
          businessId,
          product: { status: 'ACTIVE' },
        },
        select: { quantity: true, lowStockThreshold: true },
      }),
    ]);

  const lowStockCount = inventories.filter(
    (item) => item.quantity <= item.lowStockThreshold
  ).length;

  const revenueByMonth = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const expenseByMonth = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const salesCountByMonth = new Map(buckets.map((bucket) => [bucket.key, 0]));

  for (const sale of sales) {
    const key = monthKey(sale.soldAt);
    if (!revenueByMonth.has(key)) continue;
    revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + toMoneyNumber(sale.total));
    salesCountByMonth.set(key, (salesCountByMonth.get(key) || 0) + 1);
  }

  for (const expense of expenses) {
    const key = monthKey(expense.expenseDate);
    if (!expenseByMonth.has(key)) continue;
    expenseByMonth.set(key, (expenseByMonth.get(key) || 0) + toMoneyNumber(expense.amount));
  }

  const monthlyTrend = buckets.map((bucket) => {
    const revenue = revenueByMonth.get(bucket.key) || 0;
    const expenseTotal = expenseByMonth.get(bucket.key) || 0;
    return {
      key: bucket.key,
      label: bucket.label,
      revenue,
      expenses: expenseTotal,
      net: revenue - expenseTotal,
      salesCount: salesCountByMonth.get(bucket.key) || 0,
    };
  });

  const productMap = new Map<
    string,
    { productId: string; productName: string; productSku: string; revenue: number; quantity: number }
  >();
  for (const item of saleItems) {
    const existing = productMap.get(item.productId);
    const revenue = toMoneyNumber(item.lineTotal);
    if (existing) {
      existing.revenue += revenue;
      existing.quantity += item.quantity;
    } else {
      productMap.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        revenue,
        quantity: item.quantity,
      });
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((item) => ({
      ...item,
      revenue: Number(item.revenue.toFixed(2)),
    }));

  const categoryNameMap = new Map(expenseCategories.map((category) => [category.id, category.name]));
  const expenseCategoryMap = new Map<string, number>();
  for (const expense of expenses) {
    const label = expense.categoryId
      ? categoryNameMap.get(expense.categoryId) || 'Uncategorized'
      : 'Uncategorized';
    expenseCategoryMap.set(
      label,
      (expenseCategoryMap.get(label) || 0) + toMoneyNumber(expense.amount)
    );
  }

  const expensesByCategory = Array.from(expenseCategoryMap.entries())
    .map(([categoryName, amount]) => ({ categoryName, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount);

  const totalRevenue = monthlyTrend.reduce((sum, row) => sum + row.revenue, 0);
  const totalExpenses = monthlyTrend.reduce((sum, row) => sum + row.expenses, 0);
  const totalSales = monthlyTrend.reduce((sum, row) => sum + row.salesCount, 0);

  return {
    period: {
      label: `Last ${months} months`,
      months,
      start: rangeStart,
      end: rangeEnd,
    },
    summary: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      netResult: Number((totalRevenue - totalExpenses).toFixed(2)),
      totalSales,
      activeCustomers,
      activeProducts,
      lowStockCount,
    },
    monthlyTrend,
    topProducts,
    expensesByCategory,
  };
}
