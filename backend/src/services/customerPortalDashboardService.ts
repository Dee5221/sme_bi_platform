import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export async function getCustomerPortalDashboard(businessId: string, customerId: string) {
  const periodStart = startOfMonth();
  const periodEnd = endOfMonth();

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId, status: 'ACTIVE' },
    select: { id: true, name: true, email: true },
  });

  if (!customer) {
    throw new AppError(404, 'Linked customer record not found.', 'NOT_FOUND');
  }

  const saleFilter = {
    businessId,
    customerId,
    status: 'COMPLETED' as const,
  };

  const [lifetimeAgg, monthAgg, recentPurchases, business] = await Promise.all([
    prisma.sale.aggregate({
      where: saleFilter,
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.sale.aggregate({
      where: {
        ...saleFilter,
        soldAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.sale.findMany({
      where: saleFilter,
      include: {
        items: { select: { id: true, productName: true, quantity: true } },
      },
      orderBy: { soldAt: 'desc' },
      take: 8,
    }),
    prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    }),
  ]);

  const lifetimeSpent = toMoneyNumber(lifetimeAgg._sum.total ?? new Prisma.Decimal(0));
  const monthSpent = toMoneyNumber(monthAgg._sum.total ?? new Prisma.Decimal(0));
  const lifetimeCount = lifetimeAgg._count._all;
  const monthCount = monthAgg._count._all;

  return {
    business: business
      ? { id: business.id, name: business.name }
      : { id: businessId, name: 'Business' },
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
    },
    period: {
      label: 'This month',
      monthStart: periodStart,
      monthEnd: periodEnd,
    },
    kpis: {
      lifetimeSpent,
      lifetimePurchaseCount: lifetimeCount,
      monthSpent,
      monthPurchaseCount: monthCount,
      averageOrderValue:
        lifetimeCount === 0 ? 0 : Math.round((lifetimeSpent / lifetimeCount) * 100) / 100,
    },
    recentPurchases: recentPurchases.map((sale) => ({
      id: sale.id,
      saleNumber: sale.saleNumber,
      total: toMoneyNumber(sale.total),
      soldAt: sale.soldAt,
      itemCount: sale.items.length,
      items: sale.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
      })),
    })),
  };
}
