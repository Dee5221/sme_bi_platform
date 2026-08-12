import { AppError } from '../lib/errors';
import { toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';

export type ReportsQuery = {
  startDate?: string;
  endDate?: string;
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseDateInput(value: string, end = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new AppError(400, 'Invalid date format. Use YYYY-MM-DD.', 'INVALID_DATE');
  }
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'Invalid date value.', 'INVALID_DATE');
  }
  return end ? endOfDay(parsed) : startOfDay(parsed);
}

function resolveReportPeriod(query: ReportsQuery) {
  const now = new Date();
  const start = query.startDate ? parseDateInput(query.startDate) : startOfMonth(now);
  const end = query.endDate ? parseDateInput(query.endDate, true) : endOfMonth(now);

  if (start > end) {
    throw new AppError(400, 'Start date must be on or before end date.', 'INVALID_DATE_RANGE');
  }

  const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxRangeMs) {
    throw new AppError(400, 'Report range cannot exceed 366 days.', 'INVALID_DATE_RANGE');
  }

  return { start, end };
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function getReport(businessId: string, query: ReportsQuery) {
  const { start, end } = resolveReportPeriod(query);

  const [business, sales, expenses, expenseCategories, inventories, saleItems] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    }),
    prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        soldAt: { gte: start, lte: end },
      },
      include: {
        customer: { select: { id: true, name: true } },
        items: { select: { id: true } },
      },
      orderBy: { soldAt: 'desc' },
    }),
    prisma.expense.findMany({
      where: {
        businessId,
        status: 'ACTIVE',
        expenseDate: { gte: start, lte: end },
      },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { expenseDate: 'desc' },
    }),
    prisma.expenseCategory.findMany({
      where: { businessId },
      select: { id: true, name: true },
    }),
    prisma.inventory.findMany({
      where: {
        businessId,
        product: { status: 'ACTIVE' },
      },
      select: {
        quantity: true,
        lowStockThreshold: true,
        product: { select: { id: true, name: true, sku: true, price: true } },
      },
      orderBy: { product: { name: 'asc' } },
    }),
    prisma.saleItem.findMany({
      where: {
        sale: {
          businessId,
          status: 'COMPLETED',
          soldAt: { gte: start, lte: end },
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
  ]);

  const totalRevenue = sales.reduce((sum, sale) => sum + toMoneyNumber(sale.total), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + toMoneyNumber(expense.amount), 0);
  const salesCount = sales.length;
  const expenseCount = expenses.length;

  const salesRows = sales.map((sale) => ({
    id: sale.id,
    saleNumber: sale.saleNumber,
    soldAt: sale.soldAt,
    customerName: sale.customer?.name ?? 'Walk-in',
    itemCount: sale.items.length,
    total: roundMoney(toMoneyNumber(sale.total)),
  }));

  const expenseRows = expenses.map((expense) => ({
    id: expense.id,
    title: expense.title,
    expenseDate: expense.expenseDate,
    categoryName: expense.category?.name ?? 'Uncategorized',
    amount: roundMoney(toMoneyNumber(expense.amount)),
  }));

  const categoryNameMap = new Map(expenseCategories.map((row) => [row.id, row.name]));
  const expensesByCategoryMap = new Map<string, number>();
  for (const expense of expenses) {
    const label = expense.categoryId
      ? categoryNameMap.get(expense.categoryId) || expense.category?.name || 'Uncategorized'
      : 'Uncategorized';
    expensesByCategoryMap.set(
      label,
      (expensesByCategoryMap.get(label) || 0) + toMoneyNumber(expense.amount)
    );
  }
  const expensesByCategory = Array.from(expensesByCategoryMap.entries())
    .map(([categoryName, amount]) => ({ categoryName, amount: roundMoney(amount) }))
    .sort((a, b) => b.amount - a.amount);

  let totalUnitsOnHand = 0;
  let inventoryValue = 0;
  let lowStockCount = 0;
  const inventoryRows = inventories.map((item) => {
    const unitPrice = toMoneyNumber(item.product.price);
    const lineValue = roundMoney(item.quantity * unitPrice);
    const isLowStock = item.quantity <= item.lowStockThreshold;
    totalUnitsOnHand += item.quantity;
    inventoryValue += lineValue;
    if (isLowStock) lowStockCount += 1;
    return {
      productId: item.product.id,
      productName: item.product.name,
      sku: item.product.sku,
      quantity: item.quantity,
      lowStockThreshold: item.lowStockThreshold,
      unitPrice: roundMoney(unitPrice),
      inventoryValue: lineValue,
      isLowStock,
    };
  });

  const productTotals = new Map<
    string,
    { productId: string; productName: string; productSku: string; quantity: number; revenue: number }
  >();
  for (const item of saleItems) {
    const existing = productTotals.get(item.productId);
    const revenue = toMoneyNumber(item.lineTotal);
    if (existing) {
      existing.quantity += item.quantity;
      existing.revenue += revenue;
    } else {
      productTotals.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity,
        revenue,
      });
    }
  }
  const topProducts = Array.from(productTotals.values())
    .map((row) => ({ ...row, revenue: roundMoney(row.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    business: business ? { id: business.id, name: business.name } : { id: businessId, name: 'Business' },
    period: {
      start,
      end,
      label: `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`,
    },
    summary: {
      totalRevenue: roundMoney(totalRevenue),
      totalExpenses: roundMoney(totalExpenses),
      netResult: roundMoney(totalRevenue - totalExpenses),
      salesCount,
      expenseCount,
      averageOrderValue: salesCount ? roundMoney(totalRevenue / salesCount) : 0,
      trackedProducts: inventoryRows.length,
      totalUnitsOnHand,
      inventoryValue: roundMoney(inventoryValue),
      lowStockCount,
    },
    sales: {
      rows: salesRows,
      totalAmount: roundMoney(totalRevenue),
      count: salesCount,
    },
    expenses: {
      rows: expenseRows,
      totalAmount: roundMoney(totalExpenses),
      count: expenseCount,
      byCategory: expensesByCategory,
    },
    inventory: {
      rows: inventoryRows,
      totalUnits: totalUnitsOnHand,
      totalValue: roundMoney(inventoryValue),
      lowStockCount,
    },
    topProducts,
  };
}
