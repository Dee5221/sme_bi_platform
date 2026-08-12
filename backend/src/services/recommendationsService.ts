import { toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';

export type RecommendationsQuery = {
  months?: number;
};

type RecommendationCategory = 'INVENTORY' | 'SALES' | 'EXPENSES' | 'CUSTOMERS' | 'BUSINESS';
type RecommendationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type Recommendation = {
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  message: string;
  actionLabel?: string;
  actionPath?: string;
};

function clampMonths(months?: number) {
  if (!months || Number.isNaN(months)) return 6;
  return Math.min(12, Math.max(3, Math.floor(months)));
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function priorityRank(priority: RecommendationPriority) {
  return priority === 'HIGH' ? 0 : priority === 'MEDIUM' ? 1 : 2;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function getRecommendations(businessId: string, query: RecommendationsQuery) {
  const months = clampMonths(query.months);
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - (months - 1));
  rangeStart.setDate(1);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date();
  const periodStart = startOfMonth();
  const periodEnd = endOfMonth();

  const [inventories, sales, expenses, expenseCategories, customers, saleItems] =
    await Promise.all([
      prisma.inventory.findMany({
        where: { businessId, product: { status: 'ACTIVE' } },
        select: {
          quantity: true,
          lowStockThreshold: true,
          product: { select: { id: true, name: true, sku: true } },
        },
      }),
      prisma.sale.findMany({
        where: {
          businessId,
          status: 'COMPLETED',
          soldAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: { id: true, total: true, customerId: true, soldAt: true },
      }),
      prisma.expense.findMany({
        where: {
          businessId,
          status: 'ACTIVE',
          expenseDate: { gte: rangeStart, lte: rangeEnd },
        },
        select: { amount: true, categoryId: true, expenseDate: true },
      }),
      prisma.expenseCategory.findMany({
        where: { businessId },
        select: { id: true, name: true },
      }),
      prisma.customer.count({ where: { businessId, status: 'ACTIVE' } }),
      prisma.saleItem.findMany({
        where: {
          sale: {
            businessId,
            status: 'COMPLETED',
            soldAt: { gte: rangeStart, lte: rangeEnd },
          },
        },
        select: { productId: true, productName: true, quantity: true },
      }),
    ]);

  const recommendations: Recommendation[] = [];

  const productDemand = new Map<string, { productName: string; unitsSold: number }>();
  for (const item of saleItems) {
    const existing = productDemand.get(item.productId);
    if (existing) {
      existing.unitsSold += item.quantity;
    } else {
      productDemand.set(item.productId, {
        productName: item.productName,
        unitsSold: item.quantity,
      });
    }
  }

  for (const item of inventories) {
    if (item.quantity === 0) {
      recommendations.push({
        id: `out-of-stock-${item.product.id}`,
        category: 'INVENTORY',
        priority: 'HIGH',
        title: `Restock ${item.product.name}`,
        message: `${item.product.sku} is out of stock. Receive inventory before accepting new sales for this product.`,
        actionLabel: 'Manage inventory',
        actionPath: '/app/inventory',
      });
      continue;
    }

    if (item.quantity <= item.lowStockThreshold) {
      recommendations.push({
        id: `low-stock-${item.product.id}`,
        category: 'INVENTORY',
        priority: 'HIGH',
        title: `Low stock: ${item.product.name}`,
        message: `${item.quantity} units remain, at or below the alert threshold of ${item.lowStockThreshold}.`,
        actionLabel: 'Manage inventory',
        actionPath: '/app/inventory',
      });
    }

    const demand = productDemand.get(item.product.id);
    const averageMonthlyDemand = (demand?.unitsSold || 0) / months;
    if (averageMonthlyDemand > 0) {
      const dailyDemand = averageMonthlyDemand / 30;
      const daysLeft = Math.floor(item.quantity / dailyDemand);
      const targetStock = Math.ceil(averageMonthlyDemand);
      const restockQty = Math.max(0, targetStock - item.quantity);
      if (daysLeft <= 30 && restockQty > 0) {
        recommendations.push({
          id: `restock-${item.product.id}`,
          category: 'INVENTORY',
          priority: daysLeft <= 14 ? 'HIGH' : 'MEDIUM',
          title: `Plan restock for ${item.product.name}`,
          message: `Based on recent demand (~${Number(averageMonthlyDemand.toFixed(2))} units/month), stock may run low in about ${daysLeft} days. Suggested restock: ${restockQty} units.`,
          actionLabel: 'Manage inventory',
          actionPath: '/app/inventory',
        });
      }
    }

    if (item.quantity > 0 && !demand) {
      recommendations.push({
        id: `stale-stock-${item.product.id}`,
        category: 'INVENTORY',
        priority: 'MEDIUM',
        title: `Review slow-moving stock: ${item.product.name}`,
        message: `${item.quantity} units are on hand with no sales in the last ${months} months.`,
        actionLabel: 'View products',
        actionPath: '/app/products',
      });
    }
  }

  const totalSales = sales.length;
  const customerLinkedSales = sales.filter((sale) => sale.customerId).length;
  const walkInSales = totalSales - customerLinkedSales;
  const totalRevenue = sales.reduce((sum, sale) => sum + toMoneyNumber(sale.total), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + toMoneyNumber(expense.amount), 0);

  if (totalSales === 0) {
    recommendations.push({
      id: 'record-first-sale',
      category: 'SALES',
      priority: 'HIGH',
      title: 'Record your first sale',
      message: `No completed sales were found in the last ${months} months. Start tracking revenue by recording a sale.`,
      actionLabel: 'Go to Sales',
      actionPath: '/app/sales',
    });
  }

  const thisMonthSales = sales.filter(
    (sale) => sale.soldAt >= periodStart && sale.soldAt <= periodEnd
  );
  const thisMonthExpenses = expenses.filter(
    (expense) => expense.expenseDate >= periodStart && expense.expenseDate <= periodEnd
  );
  const monthRevenue = thisMonthSales.reduce(
    (sum, sale) => sum + toMoneyNumber(sale.total),
    0
  );
  const monthExpenses = thisMonthExpenses.reduce(
    (sum, expense) => sum + toMoneyNumber(expense.amount),
    0
  );

  if (monthExpenses > monthRevenue && (monthRevenue > 0 || monthExpenses > 0)) {
    recommendations.push({
      id: 'expenses-exceed-revenue-month',
      category: 'EXPENSES',
      priority: 'HIGH',
      title: 'Expenses exceed revenue this month',
      message: `This month expenses (${roundMoney(monthExpenses)}) are higher than revenue (${roundMoney(monthRevenue)}). Review spending and sales activity.`,
      actionLabel: 'View expenses',
      actionPath: '/app/expenses',
    });
  }

  const avgMonthlyRevenue = totalRevenue / months;
  const avgMonthlyExpenses = totalExpenses / months;
  if (avgMonthlyExpenses > avgMonthlyRevenue && totalSales > 0) {
    recommendations.push({
      id: 'negative-net-trend',
      category: 'BUSINESS',
      priority: 'HIGH',
      title: 'Average expenses exceed average revenue',
      message: `Over the last ${months} months, average monthly expenses (${roundMoney(avgMonthlyExpenses)}) exceed average revenue (${roundMoney(avgMonthlyRevenue)}).`,
      actionLabel: 'View business analytics',
      actionPath: '/app/analytics/business',
    });
  }

  const categoryNameMap = new Map(expenseCategories.map((row) => [row.id, row.name]));
  const expenseByCategory = new Map<string, number>();
  for (const expense of expenses) {
    const label = expense.categoryId
      ? categoryNameMap.get(expense.categoryId) || 'Uncategorized'
      : 'Uncategorized';
    expenseByCategory.set(label, (expenseByCategory.get(label) || 0) + toMoneyNumber(expense.amount));
  }
  if (totalExpenses > 0) {
    const topCategory = Array.from(expenseByCategory.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topCategory && topCategory[1] / totalExpenses >= 0.5) {
      recommendations.push({
        id: `expense-concentration-${topCategory[0]}`,
        category: 'EXPENSES',
        priority: 'MEDIUM',
        title: `Review ${topCategory[0]} spending`,
        message: `${topCategory[0]} accounts for ${Math.round((topCategory[1] / totalExpenses) * 100)}% of expenses in the last ${months} months.`,
        actionLabel: 'View expenses',
        actionPath: '/app/expenses',
      });
    }
  }

  if (totalSales > 0 && walkInSales / totalSales >= 0.6) {
    recommendations.push({
      id: 'high-walk-in-ratio',
      category: 'CUSTOMERS',
      priority: 'MEDIUM',
      title: 'Many sales are not linked to customers',
      message: `${walkInSales} of ${totalSales} sales (${Math.round((walkInSales / totalSales) * 100)}%) had no customer selected. Linking customers improves analytics and follow-up.`,
      actionLabel: 'Go to Sales',
      actionPath: '/app/sales',
    });
  }

  if (customers === 0 && totalSales > 0) {
    recommendations.push({
      id: 'add-customers',
      category: 'CUSTOMERS',
      priority: 'MEDIUM',
      title: 'Add customers to your directory',
      message: 'You have sales activity but no active customers yet. Adding customers helps track repeat business.',
      actionLabel: 'Manage customers',
      actionPath: '/app/customers',
    });
  }

  const customerSaleCounts = new Map<string, number>();
  for (const sale of sales) {
    if (!sale.customerId) continue;
    customerSaleCounts.set(sale.customerId, (customerSaleCounts.get(sale.customerId) || 0) + 1);
  }
  const repeatCustomers = Array.from(customerSaleCounts.values()).filter((count) => count >= 2).length;
  if (repeatCustomers > 0) {
    recommendations.push({
      id: 'repeat-customers',
      category: 'CUSTOMERS',
      priority: 'LOW',
      title: 'Repeat customers identified',
      message: `${repeatCustomers} customer${repeatCustomers === 1 ? '' : 's'} made multiple purchases in the last ${months} months. Consider follow-up or loyalty efforts.`,
      actionLabel: 'View customer analytics',
      actionPath: '/app/analytics/customers',
    });
  }

  const topProduct = Array.from(productDemand.entries()).sort(
    (a, b) => b[1].unitsSold - a[1].unitsSold
  )[0];
  if (topProduct && totalSales >= 3) {
    recommendations.push({
      id: `top-product-${topProduct[0]}`,
      category: 'SALES',
      priority: 'LOW',
      title: `Top seller: ${topProduct[1].productName}`,
      message: `${topProduct[1].productName} sold ${topProduct[1].unitsSold} units in the last ${months} months. Ensure inventory keeps pace with demand.`,
      actionLabel: 'View sales analytics',
      actionPath: '/app/analytics/sales',
    });
  }

  recommendations.sort(
    (a, b) =>
      priorityRank(a.priority) - priorityRank(b.priority) ||
      a.title.localeCompare(b.title)
  );

  const highPriority = recommendations.filter((row) => row.priority === 'HIGH').length;
  const mediumPriority = recommendations.filter((row) => row.priority === 'MEDIUM').length;
  const lowPriority = recommendations.filter((row) => row.priority === 'LOW').length;

  return {
    period: {
      label: `Last ${months} months`,
      months,
      start: rangeStart,
      end: rangeEnd,
    },
    summary: {
      total: recommendations.length,
      highPriority,
      mediumPriority,
      lowPriority,
    },
    recommendations,
  };
}
