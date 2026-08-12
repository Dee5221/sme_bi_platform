import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function movementFilter(businessId: string, supplierId: string) {
  return {
    businessId,
    supplierId,
    type: 'STOCK_IN' as const,
  };
}

export async function getSupplierPortalDashboard(businessId: string, supplierId: string) {
  const periodStart = startOfMonth();
  const periodEnd = endOfMonth();

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, businessId, status: 'ACTIVE' },
    select: { id: true, name: true, email: true },
  });

  if (!supplier) {
    throw new AppError(404, 'Linked supplier record not found.', 'NOT_FOUND');
  }

  const baseFilter = movementFilter(businessId, supplierId);

  const [lifetimeRecords, monthRecords, productGroups, recentRecords, business] =
    await Promise.all([
      prisma.stockMovement.findMany({
        where: baseFilter,
        select: { quantityChange: true },
      }),
      prisma.stockMovement.findMany({
        where: {
          ...baseFilter,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        select: { quantityChange: true },
      }),
      prisma.stockMovement.groupBy({
        by: ['productId'],
        where: baseFilter,
      }),
      prisma.stockMovement.findMany({
        where: baseFilter,
        include: {
          inventory: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true },
      }),
    ]);

  const lifetimeUnits = lifetimeRecords.reduce(
    (sum, record) => sum + record.quantityChange,
    0
  );
  const monthUnits = monthRecords.reduce((sum, record) => sum + record.quantityChange, 0);

  return {
    business: business
      ? { id: business.id, name: business.name }
      : { id: businessId, name: 'Business' },
    supplier: {
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
    },
    period: {
      label: 'This month',
      monthStart: periodStart,
      monthEnd: periodEnd,
    },
    kpis: {
      lifetimeSupplyRecords: lifetimeRecords.length,
      lifetimeUnitsSupplied: lifetimeUnits,
      monthSupplyRecords: monthRecords.length,
      monthUnitsSupplied: monthUnits,
      productsSupplied: productGroups.length,
      averageUnitsPerRecord:
        lifetimeRecords.length === 0
          ? 0
          : Math.round((lifetimeUnits / lifetimeRecords.length) * 100) / 100,
    },
    recentSupplyRecords: recentRecords.map((record) => ({
      id: record.id,
      productId: record.productId,
      productName: record.inventory.product.name,
      productSku: record.inventory.product.sku,
      quantity: record.quantityChange,
      reason: record.reason,
      createdAt: record.createdAt,
    })),
  };
}
