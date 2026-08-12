import { Prisma } from '@prisma/client';
import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';
import { StockAdjustInput, UpdateThresholdInput } from '../validators/inventoryValidators';

export type InventoryListQuery = {
  search?: string;
  lowStockOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export type MovementListQuery = {
  productId?: string;
  type?: 'STOCK_IN' | 'STOCK_OUT' | 'ALL';
  page?: number;
  pageSize?: number;
};

function mapInventoryItem(row: {
  id: string;
  businessId: string;
  productId: string;
  quantity: number;
  lowStockThreshold: number;
  updatedAt: Date;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string | null;
    status: string;
    price: Prisma.Decimal;
  };
}) {
  const isLowStock = row.quantity <= row.lowStockThreshold;
  return {
    id: row.id,
    businessId: row.businessId,
    productId: row.productId,
    quantity: row.quantity,
    lowStockThreshold: row.lowStockThreshold,
    isLowStock,
    updatedAt: row.updatedAt,
    product: {
      id: row.product.id,
      name: row.product.name,
      sku: row.product.sku,
      unit: row.product.unit,
      status: row.product.status,
      price: toMoneyNumber(row.product.price),
    },
  };
}

function mapMovement(row: {
  id: string;
  businessId: string;
  inventoryId: string;
  productId: string;
  type: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string | null;
  createdAt: Date;
  product?: { id: string; name: string; sku: string };
  actor?: { id: string; firstName: string; lastName: string } | null;
}) {
  return {
    id: row.id,
    businessId: row.businessId,
    inventoryId: row.inventoryId,
    productId: row.productId,
    type: row.type,
    quantityChange: row.quantityChange,
    quantityBefore: row.quantityBefore,
    quantityAfter: row.quantityAfter,
    reason: row.reason,
    createdAt: row.createdAt,
    product: row.product
      ? {
          id: row.product.id,
          name: row.product.name,
          sku: row.product.sku,
        }
      : undefined,
    actor: row.actor
      ? {
          id: row.actor.id,
          name: `${row.actor.firstName} ${row.actor.lastName}`,
        }
      : null,
  };
}

export async function listInventory(businessId: string, query: InventoryListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

  const where: Prisma.InventoryWhereInput = {
    businessId,
    product: {
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
    ...(query.lowStockOnly
      ? {
          // quantity <= lowStockThreshold evaluated in app filter for SQLite simplicity,
          // then re-query — better: fetch and filter. For correctness with pagination,
          // use raw comparison via Prisma unavailable for column-to-column; filter after.
        }
      : {}),
  };

  if (query.lowStockOnly) {
    const all = await prisma.inventory.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
            status: true,
            price: true,
          },
        },
      },
      orderBy: [{ quantity: 'asc' }, { updatedAt: 'desc' }],
    });

    const filtered = all.filter((item) => item.quantity <= item.lowStockThreshold);
    const total = filtered.length;
    const items = filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map(mapInventoryItem);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  const [total, rows] = await prisma.$transaction([
    prisma.inventory.count({ where }),
    prisma.inventory.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
            status: true,
            price: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(mapInventoryItem),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function adjustStock(
  businessId: string,
  actorId: string,
  type: 'STOCK_IN' | 'STOCK_OUT',
  input: StockAdjustInput
) {
  const inventory = await prisma.inventory.findFirst({
    where: {
      businessId,
      productId: input.productId,
      product: { status: 'ACTIVE' },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          status: true,
          price: true,
        },
      },
    },
  });

  if (!inventory) {
    throw new AppError(404, 'Inventory record not found for this product.', 'NOT_FOUND');
  }

  const quantityBefore = inventory.quantity;
  const quantityChange = type === 'STOCK_IN' ? input.quantity : -input.quantity;
  const quantityAfter = quantityBefore + quantityChange;

  if (quantityAfter < 0) {
    throw new AppError(
      400,
      `Insufficient stock. Available quantity is ${quantityBefore}.`,
      'INSUFFICIENT_STOCK'
    );
  }

  let supplierId: string | null = null;
  if (type === 'STOCK_IN' && input.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, businessId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!supplier) {
      throw new AppError(400, 'Selected supplier is invalid.', 'INVALID_SUPPLIER');
    }
    supplierId = supplier.id;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantity: quantityAfter },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
            status: true,
            price: true,
          },
        },
      },
    });

    const movement = await tx.stockMovement.create({
      data: {
        businessId,
        inventoryId: inventory.id,
        productId: inventory.productId,
        supplierId,
        actorId,
        type,
        quantityChange,
        quantityBefore,
        quantityAfter,
        reason: input.reason ?? null,
        referenceType: 'MANUAL',
      },
      include: {
        actor: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return { updated, movement };
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: type === 'STOCK_IN' ? 'inventory.stock_in' : 'inventory.stock_out',
    entity: 'Inventory',
    entityId: inventory.id,
    metadata: {
      productId: inventory.productId,
      quantity: input.quantity,
      quantityAfter,
    },
  });

  return {
    inventory: mapInventoryItem(result.updated),
    movement: mapMovement({
      ...result.movement,
      product: {
        id: result.updated.product.id,
        name: result.updated.product.name,
        sku: result.updated.product.sku,
      },
    }),
  };
}

export async function updateLowStockThreshold(
  businessId: string,
  actorId: string,
  inventoryId: string,
  input: UpdateThresholdInput
) {
  const inventory = await prisma.inventory.findFirst({
    where: { id: inventoryId, businessId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          status: true,
          price: true,
        },
      },
    },
  });

  if (!inventory) {
    throw new AppError(404, 'Inventory record not found.', 'NOT_FOUND');
  }

  const updated = await prisma.inventory.update({
    where: { id: inventoryId },
    data: { lowStockThreshold: input.lowStockThreshold },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          status: true,
          price: true,
        },
      },
    },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'inventory.threshold_updated',
    entity: 'Inventory',
    entityId: inventoryId,
    metadata: { lowStockThreshold: input.lowStockThreshold },
  });

  return mapInventoryItem(updated);
}

export async function listMovements(businessId: string, query: MovementListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const type = query.type ?? 'ALL';

  const where: Prisma.StockMovementWhereInput = {
    businessId,
    ...(query.productId ? { productId: query.productId } : {}),
    ...(type !== 'ALL' ? { type } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        actor: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const productIds = Array.from(new Set(rows.map((row) => row.productId)));
  const products = await prisma.product.findMany({
    where: { businessId, id: { in: productIds } },
    select: { id: true, name: true, sku: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  return {
    items: rows.map((row) =>
      mapMovement({
        ...row,
        product: productMap.get(row.productId),
      })
    ),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
