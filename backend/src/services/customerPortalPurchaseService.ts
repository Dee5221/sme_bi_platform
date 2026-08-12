import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';

export type CustomerPurchaseListQuery = {
  search?: string;
  page?: number;
  pageSize?: number;
};

function mapPurchase(sale: {
  id: string;
  saleNumber: string;
  status: string;
  subtotal: Prisma.Decimal;
  total: Prisma.Decimal;
  notes: string | null;
  soldAt: Date;
  createdAt: Date;
  items: {
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    unitPrice: Prisma.Decimal;
    quantity: number;
    lineTotal: Prisma.Decimal;
  }[];
}) {
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    status: sale.status,
    subtotal: toMoneyNumber(sale.subtotal),
    total: toMoneyNumber(sale.total),
    notes: sale.notes,
    soldAt: sale.soldAt,
    createdAt: sale.createdAt,
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      unitPrice: toMoneyNumber(item.unitPrice),
      quantity: item.quantity,
      lineTotal: toMoneyNumber(item.lineTotal),
    })),
  };
}

export async function listCustomerPurchases(
  businessId: string,
  customerId: string,
  query: CustomerPurchaseListQuery
) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

  const where: Prisma.SaleWhereInput = {
    businessId,
    customerId,
    status: 'COMPLETED',
    ...(query.search
      ? {
          OR: [
            { saleNumber: { contains: query.search } },
            { notes: { contains: query.search } },
            { items: { some: { productName: { contains: query.search } } } },
            { items: { some: { productSku: { contains: query.search } } } },
          ],
        }
      : {}),
  };

  const [total, sales] = await prisma.$transaction([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: { items: true },
      orderBy: [{ soldAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: sales.map(mapPurchase),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getCustomerPurchase(
  businessId: string,
  customerId: string,
  purchaseId: string
) {
  const sale = await prisma.sale.findFirst({
    where: {
      id: purchaseId,
      businessId,
      customerId,
      status: 'COMPLETED',
    },
    include: { items: true },
  });

  if (!sale) {
    throw new AppError(404, 'Purchase not found.', 'NOT_FOUND');
  }

  return mapPurchase(sale);
}
