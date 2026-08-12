import { toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';

export type ForecastingQuery = {
  months?: number;
  horizon?: number;
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

function clampHorizon(horizon?: number) {
  if (!horizon || Number.isNaN(horizon)) return 3;
  return Math.min(3, Math.max(1, Math.floor(horizon)));
}

function buildPastMonthBuckets(months: number): MonthBucket[] {
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

function buildFutureMonthBuckets(horizon: number): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const now = new Date();
  for (let offset = 1; offset <= horizon; offset += 1) {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
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

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function roundUnits(value: number) {
  return Number(value.toFixed(2));
}

type Urgency = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

function stockUrgency(
  quantity: number,
  threshold: number,
  daysUntilStockout: number | null
): Urgency {
  if (quantity <= threshold) return 'HIGH';
  if (daysUntilStockout === null) return 'NONE';
  if (daysUntilStockout <= 14) return 'HIGH';
  if (daysUntilStockout <= 30) return 'MEDIUM';
  if (daysUntilStockout <= 60) return 'LOW';
  return 'NONE';
}

export async function getForecasting(businessId: string, query: ForecastingQuery) {
  const lookbackMonths = clampMonths(query.months);
  const forecastMonths = clampHorizon(query.horizon);
  const pastBuckets = buildPastMonthBuckets(lookbackMonths);
  const futureBuckets = buildFutureMonthBuckets(forecastMonths);
  const rangeStart = pastBuckets[0]?.start ?? new Date();
  const rangeEnd = pastBuckets[pastBuckets.length - 1]?.end ?? new Date();

  const [sales, expenses, saleItems, inventories] = await Promise.all([
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
      select: { expenseDate: true, amount: true },
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
      },
    }),
    prisma.inventory.findMany({
      where: {
        businessId,
        product: { status: 'ACTIVE' },
      },
      select: {
        quantity: true,
        lowStockThreshold: true,
        product: { select: { id: true, name: true, sku: true } },
      },
    }),
  ]);

  const revenueByMonth = new Map(pastBuckets.map((bucket) => [bucket.key, 0]));
  const expenseByMonth = new Map(pastBuckets.map((bucket) => [bucket.key, 0]));
  const salesCountByMonth = new Map(pastBuckets.map((bucket) => [bucket.key, 0]));

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

  const historicalMonthly = pastBuckets.map((bucket) => {
    const revenue = revenueByMonth.get(bucket.key) || 0;
    const expenseTotal = expenseByMonth.get(bucket.key) || 0;
    const salesCount = salesCountByMonth.get(bucket.key) || 0;
    return {
      key: bucket.key,
      label: bucket.label,
      revenue: roundMoney(revenue),
      expenses: roundMoney(expenseTotal),
      netResult: roundMoney(revenue - expenseTotal),
      salesCount,
    };
  });

  const monthsWithSales = historicalMonthly.filter((row) => row.salesCount > 0).length;
  const monthsWithExpenses = historicalMonthly.filter((row) => row.expenses > 0).length;

  const avgRevenue = roundMoney(
    historicalMonthly.reduce((sum, row) => sum + row.revenue, 0) / lookbackMonths
  );
  const avgExpenses = roundMoney(
    historicalMonthly.reduce((sum, row) => sum + row.expenses, 0) / lookbackMonths
  );
  const avgSalesCount = roundUnits(
    historicalMonthly.reduce((sum, row) => sum + row.salesCount, 0) / lookbackMonths
  );
  const avgNet = roundMoney(avgRevenue - avgExpenses);

  const forecastMonthly = futureBuckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    revenue: avgRevenue,
    expenses: avgExpenses,
    netResult: avgNet,
    salesCount: Math.round(avgSalesCount),
  }));

  const productDemandMap = new Map<
    string,
    { productId: string; productName: string; productSku: string; unitsSold: number }
  >();
  for (const item of saleItems) {
    const existing = productDemandMap.get(item.productId);
    if (existing) {
      existing.unitsSold += item.quantity;
    } else {
      productDemandMap.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        unitsSold: item.quantity,
      });
    }
  }

  const inventoryForecasts = inventories
    .map((item) => {
      const demand = productDemandMap.get(item.product.id);
      const averageMonthlyDemand = roundUnits((demand?.unitsSold || 0) / lookbackMonths);
      const projectedDemandNextMonth = averageMonthlyDemand;
      const dailyDemand = averageMonthlyDemand / 30;
      const estimatedDaysUntilStockout =
        dailyDemand > 0 ? Math.floor(item.quantity / dailyDemand) : null;
      const targetStock = Math.ceil(averageMonthlyDemand);
      const suggestedRestockQuantity = Math.max(0, targetStock - item.quantity);
      const urgency = stockUrgency(
        item.quantity,
        item.lowStockThreshold,
        estimatedDaysUntilStockout
      );

      return {
        productId: item.product.id,
        productName: item.product.name,
        productSku: item.product.sku,
        currentQuantity: item.quantity,
        lowStockThreshold: item.lowStockThreshold,
        averageMonthlyDemand,
        projectedDemandNextMonth,
        estimatedDaysUntilStockout,
        suggestedRestockQuantity,
        urgency,
      };
    })
    .sort((a, b) => {
      const urgencyRank: Record<Urgency, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };
      const rankDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
      if (rankDiff !== 0) return rankDiff;
      const daysA = a.estimatedDaysUntilStockout ?? Number.MAX_SAFE_INTEGER;
      const daysB = b.estimatedDaysUntilStockout ?? Number.MAX_SAFE_INTEGER;
      return daysA - daysB;
    })
    .slice(0, 12);

  return {
    methodology: {
      label: 'Historical monthly average',
      description:
        'Projections use the average monthly revenue, expenses, sales count, and product demand from the selected lookback period. Inventory restock suggestions target one month of average demand.',
      lookbackMonths,
      forecastMonths,
    },
    lookback: {
      label: `Last ${lookbackMonths} months`,
      start: rangeStart,
      end: rangeEnd,
    },
    forecastPeriod: {
      label: `Next ${forecastMonths} month${forecastMonths === 1 ? '' : 's'}`,
      start: futureBuckets[0]?.start ?? new Date(),
      end: futureBuckets[futureBuckets.length - 1]?.end ?? new Date(),
    },
    historicalMonthly,
    forecastMonthly,
    summary: {
      historicalAvgRevenue: avgRevenue,
      historicalAvgExpenses: avgExpenses,
      historicalAvgSalesCount: avgSalesCount,
      historicalAvgNet: avgNet,
      projectedRevenueTotal: roundMoney(avgRevenue * forecastMonths),
      projectedExpensesTotal: roundMoney(avgExpenses * forecastMonths),
      projectedNetTotal: roundMoney(avgNet * forecastMonths),
      projectedSalesTotal: Math.round(avgSalesCount * forecastMonths),
    },
    inventoryForecasts,
    dataQuality: {
      monthsWithSales,
      monthsWithExpenses,
      hasEnoughHistory: monthsWithSales >= 1 || monthsWithExpenses >= 1,
    },
  };
}
