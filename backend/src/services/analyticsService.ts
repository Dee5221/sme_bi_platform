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

export type SalesAnalyticsQuery = {
  months?: number;
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function averageOrderValue(revenue: number, salesCount: number) {
  if (salesCount === 0) return 0;
  return roundMoney(revenue / salesCount);
}

export async function getSalesAnalytics(businessId: string, query: SalesAnalyticsQuery) {
  const months = clampMonths(query.months);
  const buckets = buildMonthBuckets(months);
  const rangeStart = buckets[0]?.start ?? new Date();
  const rangeEnd = buckets[buckets.length - 1]?.end ?? new Date();

  const sales = await prisma.sale.findMany({
    where: {
      businessId,
      status: 'COMPLETED',
      soldAt: { gte: rangeStart, lte: rangeEnd },
    },
    select: {
      id: true,
      soldAt: true,
      total: true,
      customerId: true,
      customer: { select: { id: true, name: true } },
      items: {
        select: {
          productId: true,
          productName: true,
          productSku: true,
          quantity: true,
          lineTotal: true,
        },
      },
    },
  });

  const revenueByMonth = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const salesCountByMonth = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const unitsByMonth = new Map(buckets.map((bucket) => [bucket.key, 0]));

  let totalRevenue = 0;
  let walkInSales = 0;
  let customerLinkedSales = 0;
  let walkInRevenue = 0;
  let customerRevenue = 0;
  let totalUnitsSold = 0;

  const productRevenueMap = new Map<
    string,
    { productId: string; productName: string; productSku: string; revenue: number; quantity: number }
  >();
  const customerMap = new Map<
    string,
    { customerId: string; customerName: string; salesCount: number; revenue: number }
  >();

  for (const sale of sales) {
    const revenue = toMoneyNumber(sale.total);
    const unitsInSale = sale.items.reduce((sum, item) => sum + item.quantity, 0);
    totalRevenue += revenue;
    totalUnitsSold += unitsInSale;

    const key = monthKey(sale.soldAt);
    if (revenueByMonth.has(key)) {
      revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + revenue);
      salesCountByMonth.set(key, (salesCountByMonth.get(key) || 0) + 1);
      unitsByMonth.set(key, (unitsByMonth.get(key) || 0) + unitsInSale);
    }

    if (sale.customerId && sale.customer) {
      customerLinkedSales += 1;
      customerRevenue += revenue;
      const existing = customerMap.get(sale.customerId);
      if (existing) {
        existing.salesCount += 1;
        existing.revenue += revenue;
      } else {
        customerMap.set(sale.customerId, {
          customerId: sale.customerId,
          customerName: sale.customer.name,
          salesCount: 1,
          revenue,
        });
      }
    } else {
      walkInSales += 1;
      walkInRevenue += revenue;
    }

    for (const item of sale.items) {
      const itemRevenue = toMoneyNumber(item.lineTotal);
      const existing = productRevenueMap.get(item.productId);
      if (existing) {
        existing.revenue += itemRevenue;
        existing.quantity += item.quantity;
      } else {
        productRevenueMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          revenue: itemRevenue,
          quantity: item.quantity,
        });
      }
    }
  }

  const totalSales = sales.length;
  const monthlyTrend = buckets.map((bucket) => {
    const revenue = revenueByMonth.get(bucket.key) || 0;
    const salesCount = salesCountByMonth.get(bucket.key) || 0;
    return {
      key: bucket.key,
      label: bucket.label,
      revenue: roundMoney(revenue),
      salesCount,
      averageOrderValue: averageOrderValue(revenue, salesCount),
      unitsSold: unitsByMonth.get(bucket.key) || 0,
    };
  });

  const topProductsByRevenue = Array.from(productRevenueMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((item) => ({
      ...item,
      revenue: roundMoney(item.revenue),
    }));

  const topProductsByQuantity = Array.from(productRevenueMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8)
    .map((item) => ({
      ...item,
      revenue: roundMoney(item.revenue),
    }));

  const topCustomers = Array.from(customerMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((item) => ({
      ...item,
      revenue: roundMoney(item.revenue),
    }));

  return {
    period: {
      label: `Last ${months} months`,
      months,
      start: rangeStart,
      end: rangeEnd,
    },
    summary: {
      totalRevenue: roundMoney(totalRevenue),
      totalSales,
      averageOrderValue: averageOrderValue(totalRevenue, totalSales),
      totalUnitsSold,
      walkInSales,
      customerLinkedSales,
      walkInRevenue: roundMoney(walkInRevenue),
      customerRevenue: roundMoney(customerRevenue),
    },
    monthlyTrend,
    topProductsByRevenue,
    topProductsByQuantity,
    topCustomers,
    walkInSummary: {
      salesCount: walkInSales,
      revenue: roundMoney(walkInRevenue),
    },
  };
}

export type InventoryAnalyticsQuery = {
  months?: number;
};

export async function getInventoryAnalytics(businessId: string, query: InventoryAnalyticsQuery) {
  const months = clampMonths(query.months);
  const buckets = buildMonthBuckets(months);
  const rangeStart = buckets[0]?.start ?? new Date();
  const rangeEnd = buckets[buckets.length - 1]?.end ?? new Date();

  const [inventories, rawMovements] = await Promise.all([
    prisma.inventory.findMany({
      where: {
        businessId,
        product: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        quantity: true,
        lowStockThreshold: true,
        product: {
          select: { id: true, name: true, sku: true, price: true },
        },
      },
      orderBy: { quantity: 'asc' },
    }),
    prisma.stockMovement.findMany({
      where: {
        businessId,
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        id: true,
        productId: true,
        type: true,
        quantityChange: true,
        createdAt: true,
      },
    }),
  ]);

  const productInfoMap = new Map(
    inventories.map((item) => [
      item.product.id,
      { id: item.product.id, name: item.product.name, sku: item.product.sku },
    ])
  );
  const movements = rawMovements.filter((movement) => productInfoMap.has(movement.productId));

  let totalUnitsOnHand = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let healthyStockCount = 0;
  let inventoryValue = 0;

  const lowStockProducts: Array<{
    inventoryId: string;
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    lowStockThreshold: number;
  }> = [];

  for (const item of inventories) {
    totalUnitsOnHand += item.quantity;
    inventoryValue += item.quantity * toMoneyNumber(item.product.price);

    if (item.quantity === 0) {
      outOfStockCount += 1;
    } else if (item.quantity <= item.lowStockThreshold) {
      lowStockCount += 1;
      lowStockProducts.push({
        inventoryId: item.id,
        productId: item.product.id,
        productName: item.product.name,
        productSku: item.product.sku,
        quantity: item.quantity,
        lowStockThreshold: item.lowStockThreshold,
      });
    } else {
      healthyStockCount += 1;
    }
  }

  const trackedProducts = inventories.length;
  const percentHealthy =
    trackedProducts === 0 ? 100 : Math.round((healthyStockCount / trackedProducts) * 100);

  const stockInByMonth = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const stockOutByMonth = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const stockInMovementsByMonth = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const stockOutMovementsByMonth = new Map(buckets.map((bucket) => [bucket.key, 0]));

  let periodStockIn = 0;
  let periodStockOut = 0;
  let stockInMovements = 0;
  let stockOutMovements = 0;

  const productInMap = new Map<
    string,
    { productId: string; productName: string; productSku: string; units: number; movements: number }
  >();
  const productOutMap = new Map<
    string,
    { productId: string; productName: string; productSku: string; units: number; movements: number }
  >();

  for (const movement of movements) {
    const units = Math.abs(movement.quantityChange);
    const key = monthKey(movement.createdAt);

    if (movement.type === 'STOCK_IN') {
      periodStockIn += units;
      stockInMovements += 1;
      if (stockInByMonth.has(key)) {
        stockInByMonth.set(key, (stockInByMonth.get(key) || 0) + units);
        stockInMovementsByMonth.set(
          key,
          (stockInMovementsByMonth.get(key) || 0) + 1
        );
      }
      const existing = productInMap.get(movement.productId);
      const product = productInfoMap.get(movement.productId)!;
      if (existing) {
        existing.units += units;
        existing.movements += 1;
      } else {
        productInMap.set(movement.productId, {
          productId: movement.productId,
          productName: product.name,
          productSku: product.sku,
          units,
          movements: 1,
        });
      }
    } else if (movement.type === 'STOCK_OUT') {
      periodStockOut += units;
      stockOutMovements += 1;
      if (stockOutByMonth.has(key)) {
        stockOutByMonth.set(key, (stockOutByMonth.get(key) || 0) + units);
        stockOutMovementsByMonth.set(
          key,
          (stockOutMovementsByMonth.get(key) || 0) + 1
        );
      }
      const existing = productOutMap.get(movement.productId);
      const product = productInfoMap.get(movement.productId)!;
      if (existing) {
        existing.units += units;
        existing.movements += 1;
      } else {
        productOutMap.set(movement.productId, {
          productId: movement.productId,
          productName: product.name,
          productSku: product.sku,
          units,
          movements: 1,
        });
      }
    }
  }

  const monthlyTrend = buckets.map((bucket) => {
    const stockIn = stockInByMonth.get(bucket.key) || 0;
    const stockOut = stockOutByMonth.get(bucket.key) || 0;
    return {
      key: bucket.key,
      label: bucket.label,
      stockIn,
      stockOut,
      netMovement: stockIn - stockOut,
      stockInMovements: stockInMovementsByMonth.get(bucket.key) || 0,
      stockOutMovements: stockOutMovementsByMonth.get(bucket.key) || 0,
    };
  });

  const topStockInProducts = Array.from(productInMap.values())
    .sort((a, b) => b.units - a.units)
    .slice(0, 8);

  const topStockOutProducts = Array.from(productOutMap.values())
    .sort((a, b) => b.units - a.units)
    .slice(0, 8);

  return {
    period: {
      label: `Last ${months} months`,
      months,
      start: rangeStart,
      end: rangeEnd,
    },
    summary: {
      trackedProducts,
      totalUnitsOnHand,
      inventoryValue: roundMoney(inventoryValue),
      lowStockCount,
      outOfStockCount,
      healthyStockCount,
      percentHealthy,
      periodStockIn,
      periodStockOut,
      netMovement: periodStockIn - periodStockOut,
    },
    monthlyTrend,
    lowStockProducts: lowStockProducts.slice(0, 8),
    topStockInProducts,
    topStockOutProducts,
    movementBreakdown: {
      stockInMovements,
      stockOutMovements,
      stockInUnits: periodStockIn,
      stockOutUnits: periodStockOut,
    },
  };
}
