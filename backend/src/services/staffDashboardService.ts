import { Prisma } from '@prisma/client';
import { toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export async function getStaffDashboard(businessId: string) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const periodStart = startOfMonth();
  const periodEnd = endOfMonth();

  const [todayAgg, monthAgg, activeProducts, inventories, recentSales, business] =
    await Promise.all([
      prisma.sale.aggregate({
        where: {
          businessId,
          status: 'COMPLETED',
          soldAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.sale.aggregate({
        where: {
          businessId,
          status: 'COMPLETED',
          soldAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.product.count({
        where: { businessId, status: 'ACTIVE' },
      }),
      prisma.inventory.findMany({
        where: {
          businessId,
          product: { status: 'ACTIVE' },
        },
        select: {
          id: true,
          quantity: true,
          lowStockThreshold: true,
          product: { select: { id: true, name: true, sku: true } },
        },
        orderBy: { quantity: 'asc' },
      }),
      prisma.sale.findMany({
        where: { businessId },
        include: {
          customer: { select: { id: true, name: true } },
          items: { select: { id: true } },
        },
        orderBy: { soldAt: 'desc' },
        take: 8,
      }),
      prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true },
      }),
    ]);

  const lowStockItems = inventories
    .filter((item) => item.quantity <= item.lowStockThreshold)
    .map((item) => ({
      inventoryId: item.id,
      productId: item.product.id,
      productName: item.product.name,
      sku: item.product.sku,
      quantity: item.quantity,
      lowStockThreshold: item.lowStockThreshold,
    }));

  const inventoryTracked = inventories.length;
  const healthyCount = inventoryTracked - lowStockItems.length;
  const inventoryHealthPercent =
    inventoryTracked === 0
      ? 100
      : Math.round((healthyCount / inventoryTracked) * 100);

  return {
    business: business
      ? { id: business.id, name: business.name }
      : { id: businessId, name: 'Business' },
    period: {
      label: 'Today and this month',
      todayStart,
      todayEnd,
      monthStart: periodStart,
      monthEnd: periodEnd,
    },
    kpis: {
      todayRevenue: toMoneyNumber(todayAgg._sum.total ?? new Prisma.Decimal(0)),
      todaySaleCount: todayAgg._count._all,
      monthRevenue: toMoneyNumber(monthAgg._sum.total ?? new Prisma.Decimal(0)),
      monthSaleCount: monthAgg._count._all,
      activeProducts,
      lowStockCount: lowStockItems.length,
    },
    inventoryHealth: {
      trackedProducts: inventoryTracked,
      healthyProducts: healthyCount,
      percentHealthy: inventoryHealthPercent,
    },
    lowStockItems: lowStockItems.slice(0, 6),
    recentSales: recentSales.map((sale) => ({
      id: sale.id,
      saleNumber: sale.saleNumber,
      total: toMoneyNumber(sale.total),
      soldAt: sale.soldAt,
      customerName: sale.customer?.name ?? 'Walk-in',
      itemCount: sale.items.length,
    })),
  };
}
