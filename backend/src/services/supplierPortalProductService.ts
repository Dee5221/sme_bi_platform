import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';

export type SuppliedProductListQuery = {
  search?: string;
  page?: number;
  pageSize?: number;
};

function movementFilter(businessId: string, supplierId: string) {
  return {
    businessId,
    supplierId,
    type: 'STOCK_IN' as const,
  };
}

export async function listSuppliedProducts(
  businessId: string,
  supplierId: string,
  query: SuppliedProductListQuery
) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

  const groups = await prisma.stockMovement.groupBy({
    by: ['productId'],
    where: movementFilter(businessId, supplierId),
    _sum: { quantityChange: true },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  if (groups.length === 0) {
    return {
      items: [],
      pagination: { page, pageSize, total: 0, totalPages: 1 },
    };
  }

  const productIds = groups.map((group) => group.productId);
  const products = await prisma.product.findMany({
    where: {
      businessId,
      id: { in: productIds },
      status: 'ACTIVE',
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { sku: { contains: query.search } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, sku: true, unit: true },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const groupMap = new Map(groups.map((group) => [group.productId, group]));

  const items = productIds
    .map((productId) => {
      const product = productMap.get(productId);
      const group = groupMap.get(productId);
      if (!product || !group) return null;
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        totalUnitsSupplied: group._sum.quantityChange ?? 0,
        supplyRecordCount: group._count._all,
        lastSuppliedAt: group._max.createdAt,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort(
      (a, b) =>
        new Date(b.lastSuppliedAt ?? 0).getTime() -
        new Date(a.lastSuppliedAt ?? 0).getTime()
    );

  const total = items.length;
  const start = (page - 1) * pageSize;
  const pagedItems = items.slice(start, start + pageSize);

  return {
    items: pagedItems,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getSuppliedProduct(
  businessId: string,
  supplierId: string,
  productId: string
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId, status: 'ACTIVE' },
    select: { id: true, name: true, sku: true, unit: true },
  });

  if (!product) {
    throw new AppError(404, 'Product not found.', 'NOT_FOUND');
  }

  const [records, aggregate] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        ...movementFilter(businessId, supplierId),
        productId,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.stockMovement.aggregate({
      where: {
        ...movementFilter(businessId, supplierId),
        productId,
      },
      _sum: { quantityChange: true },
      _count: { _all: true },
    }),
  ]);

  if (aggregate._count._all === 0) {
    throw new AppError(404, 'No supply records found for this product.', 'NOT_FOUND');
  }

  return {
    product,
    totalUnitsSupplied: aggregate._sum.quantityChange ?? 0,
    supplyRecordCount: aggregate._count._all,
    supplyRecords: records.map((record) => ({
      id: record.id,
      quantity: record.quantityChange,
      reason: record.reason,
      createdAt: record.createdAt,
    })),
  };
}
