import { Prisma } from '@prisma/client';
import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { parseMoney, toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';
import { CreateSaleInput } from '../validators/saleValidators';

export type SaleListQuery = {
  search?: string;
  customerId?: string;
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

function mapSale(sale: {
  id: string;
  businessId: string;
  customerId: string | null;
  createdById: string | null;
  saleNumber: string;
  status: string;
  subtotal: Prisma.Decimal;
  total: Prisma.Decimal;
  notes: string | null;
  soldAt: Date;
  createdAt: Date;
  customer?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  items?: {
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
    businessId: sale.businessId,
    customerId: sale.customerId,
    createdById: sale.createdById,
    saleNumber: sale.saleNumber,
    status: sale.status,
    subtotal: toMoneyNumber(sale.subtotal),
    total: toMoneyNumber(sale.total),
    notes: sale.notes,
    soldAt: sale.soldAt,
    createdAt: sale.createdAt,
    customer: sale.customer
      ? { id: sale.customer.id, name: sale.customer.name }
      : null,
    createdBy: sale.createdBy
      ? {
          id: sale.createdBy.id,
          name: `${sale.createdBy.firstName} ${sale.createdBy.lastName}`,
        }
      : null,
    items: (sale.items || []).map((item) => ({
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

async function nextSaleNumber(tx: Prisma.TransactionClient, businessId: string) {
  const count = await tx.sale.count({ where: { businessId } });
  return `SALE-${String(count + 1).padStart(6, '0')}`;
}

export async function listSales(businessId: string, query: SaleListQuery) {
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
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(soldAt ? { soldAt } : {}),
    ...(query.search
      ? {
          OR: [
            { saleNumber: { contains: query.search } },
            { notes: { contains: query.search } },
            { customer: { name: { contains: query.search } } },
          ],
        }
      : {}),
  };

  const [total, sales] = await prisma.$transaction([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
      orderBy: [{ soldAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: sales.map(mapSale),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getSale(businessId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, businessId },
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      items: true,
    },
  });
  if (!sale) {
    throw new AppError(404, 'Sale not found.', 'NOT_FOUND');
  }
  return mapSale(sale);
}

export async function createSale(
  businessId: string,
  actorId: string,
  input: CreateSaleInput
) {
  const consolidated = new Map<string, number>();
  for (const item of input.items) {
    consolidated.set(
      item.productId,
      (consolidated.get(item.productId) || 0) + item.quantity
    );
  }

  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, businessId, status: 'ACTIVE' },
    });
    if (!customer) {
      throw new AppError(400, 'Selected customer is invalid.', 'INVALID_CUSTOMER');
    }
  }

  const productIds = Array.from(consolidated.keys());
  const products = await prisma.product.findMany({
    where: {
      businessId,
      id: { in: productIds },
      status: 'ACTIVE',
    },
    include: {
      inventory: true,
    },
  });

  if (products.length !== productIds.length) {
    throw new AppError(
      400,
      'One or more products are invalid or inactive.',
      'INVALID_PRODUCT'
    );
  }

  for (const product of products) {
    const qty = consolidated.get(product.id) || 0;
    const available = product.inventory?.quantity ?? 0;
    if (!product.inventory) {
      throw new AppError(
        400,
        `No inventory record found for ${product.name}.`,
        'MISSING_INVENTORY'
      );
    }
    if (available < qty) {
      throw new AppError(
        400,
        `Insufficient stock for ${product.name}. Available: ${available}.`,
        'INSUFFICIENT_STOCK'
      );
    }
  }

  const productMap = new Map(products.map((product) => [product.id, product]));

  const sale = await prisma.$transaction(async (tx) => {
    let subtotal = new Prisma.Decimal(0);
    const linePayloads = [];

    for (const [productId, quantity] of consolidated.entries()) {
      const product = productMap.get(productId)!;
      const unitPrice = parseMoney(toMoneyNumber(product.price));
      const lineTotal = unitPrice.mul(quantity);
      subtotal = subtotal.add(lineTotal);
      linePayloads.push({
        productId,
        productName: product.name,
        productSku: product.sku,
        unitPrice,
        quantity,
        lineTotal,
      });
    }

    const saleNumber = await nextSaleNumber(tx, businessId);

    const created = await tx.sale.create({
      data: {
        businessId,
        customerId: input.customerId ?? null,
        createdById: actorId,
        saleNumber,
        status: 'COMPLETED',
        subtotal,
        total: subtotal,
        notes: input.notes ?? null,
        items: {
          create: linePayloads,
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
    });

    for (const [productId, quantity] of consolidated.entries()) {
      const product = productMap.get(productId)!;
      const inventory = product.inventory!;
      const quantityBefore = inventory.quantity;
      const quantityAfter = quantityBefore - quantity;

      await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: quantityAfter },
      });

      await tx.stockMovement.create({
        data: {
          businessId,
          inventoryId: inventory.id,
          productId,
          actorId,
          type: 'STOCK_OUT',
          quantityChange: -quantity,
          quantityBefore,
          quantityAfter,
          reason: `Sale ${created.saleNumber}`,
          referenceType: 'SALE',
          referenceId: created.id,
        },
      });
    }

    return created;
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'sale.created',
    entity: 'Sale',
    entityId: sale.id,
    metadata: {
      saleNumber: sale.saleNumber,
      total: toMoneyNumber(sale.total),
    },
  });

  return mapSale(sale);
}
