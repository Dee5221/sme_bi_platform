import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';

export type CustomerPurchaseListQuery = {
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
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

  let soldAt: Prisma.DateTimeFilter | undefined;
  if (query.from || query.to) {
    const start = query.from ? parseDateInput(query.from) : undefined;
    const end = query.to ? parseDateInput(query.to, true) : undefined;
    if (start && end && start > end) {
      throw new AppError(400, 'Start date must be on or before end date.', 'INVALID_DATE_RANGE');
    }
    soldAt = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    };
  }

  const where: Prisma.SaleWhereInput = {
    businessId,
    customerId,
    status: 'COMPLETED',
    ...(soldAt ? { soldAt } : {}),
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
