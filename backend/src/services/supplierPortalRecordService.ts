import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';

export type SupplierRecordListQuery = {
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

function mapSupplyRecord(record: {
  id: string;
  productId: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string | null;
  createdAt: Date;
  inventory: {
    product: {
      id: string;
      name: string;
      sku: string;
      unit: string | null;
    };
  };
}) {
  return {
    id: record.id,
    productId: record.productId,
    productName: record.inventory.product.name,
    productSku: record.inventory.product.sku,
    unit: record.inventory.product.unit,
    quantity: record.quantityChange,
    quantityBefore: record.quantityBefore,
    quantityAfter: record.quantityAfter,
    reason: record.reason,
    createdAt: record.createdAt,
  };
}

export async function listSupplierRecords(
  businessId: string,
  supplierId: string,
  query: SupplierRecordListQuery
) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

  const where: Prisma.StockMovementWhereInput = {
    ...movementFilter(businessId, supplierId),
    ...(query.search
      ? {
          OR: [
            { reason: { contains: query.search } },
            { inventory: { product: { name: { contains: query.search } } } },
            { inventory: { product: { sku: { contains: query.search } } } },
          ],
        }
      : {}),
  };

  const [total, records] = await prisma.$transaction([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        inventory: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: records.map(mapSupplyRecord),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getSupplierRecord(
  businessId: string,
  supplierId: string,
  recordId: string
) {
  const record = await prisma.stockMovement.findFirst({
    where: {
      id: recordId,
      ...movementFilter(businessId, supplierId),
    },
    include: {
      inventory: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
        },
      },
    },
  });

  if (!record) {
    throw new AppError(404, 'Purchase record not found.', 'NOT_FOUND');
  }

  return mapSupplyRecord(record);
}
