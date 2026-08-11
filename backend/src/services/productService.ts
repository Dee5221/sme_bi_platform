import { Prisma } from '@prisma/client';
import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { parseMoney, toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';
import { CreateProductInput, UpdateProductInput } from '../validators/productValidators';

export type ProductListQuery = {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  categoryId?: string;
  page?: number;
  pageSize?: number;
};

function mapProduct(product: {
  id: string;
  businessId: string;
  categoryId: string | null;
  name: string;
  sku: string;
  description: string | null;
  unit: string | null;
  price: Prisma.Decimal;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  category?: { id: string; name: string } | null;
  inventory?: { quantity: number; lowStockThreshold: number } | null;
}) {
  return {
    id: product.id,
    businessId: product.businessId,
    categoryId: product.categoryId,
    name: product.name,
    sku: product.sku,
    description: product.description,
    unit: product.unit,
    price: toMoneyNumber(product.price),
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    category: product.category
      ? { id: product.category.id, name: product.category.name }
      : null,
    inventory: product.inventory
      ? {
          quantity: product.inventory.quantity,
          lowStockThreshold: product.inventory.lowStockThreshold,
        }
      : null,
  };
}

async function assertCategoryInBusiness(businessId: string, categoryId?: string) {
  if (!categoryId) return;
  const category = await prisma.productCategory.findFirst({
    where: { id: categoryId, businessId, isActive: true },
  });
  if (!category) {
    throw new AppError(400, 'Selected category is invalid for this business.', 'INVALID_CATEGORY');
  }
}

export async function listProducts(businessId: string, query: ProductListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const status = query.status ?? 'ACTIVE';

  const where: Prisma.ProductWhereInput = {
    businessId,
    ...(status !== 'ALL' ? { status } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search } },
            { sku: { contains: query.search } },
            { description: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        inventory: { select: { quantity: true, lowStockThreshold: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: products.map(mapProduct),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getProduct(businessId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    include: {
      category: { select: { id: true, name: true } },
      inventory: { select: { quantity: true, lowStockThreshold: true } },
    },
  });
  if (!product) {
    throw new AppError(404, 'Product not found.', 'NOT_FOUND');
  }
  return mapProduct(product);
}

export async function createProduct(
  businessId: string,
  actorId: string,
  input: CreateProductInput
) {
  await assertCategoryInBusiness(businessId, input.categoryId);

  const sku = input.sku.toUpperCase();
  const existingSku = await prisma.product.findFirst({
    where: { businessId, sku },
  });
  if (existingSku) {
    throw new AppError(409, 'A product with this SKU already exists.', 'CONFLICT');
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        businessId,
        categoryId: input.categoryId ?? null,
        name: input.name,
        sku,
        description: input.description ?? null,
        unit: input.unit ?? null,
        price: parseMoney(input.price),
        status: 'ACTIVE',
      },
    });

    await tx.inventory.create({
      data: {
        businessId,
        productId: created.id,
        quantity: 0,
        lowStockThreshold: 5,
      },
    });

    return tx.product.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        category: { select: { id: true, name: true } },
        inventory: { select: { quantity: true, lowStockThreshold: true } },
      },
    });
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'product.created',
    entity: 'Product',
    entityId: product.id,
    metadata: { sku: product.sku },
  });

  return mapProduct(product);
}

export async function updateProduct(
  businessId: string,
  actorId: string,
  productId: string,
  input: UpdateProductInput
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, businessId },
  });
  if (!existing) {
    throw new AppError(404, 'Product not found.', 'NOT_FOUND');
  }

  await assertCategoryInBusiness(businessId, input.categoryId);

  const sku = input.sku.toUpperCase();
  if (sku !== existing.sku) {
    const conflict = await prisma.product.findFirst({
      where: { businessId, sku, NOT: { id: productId } },
    });
    if (conflict) {
      throw new AppError(409, 'A product with this SKU already exists.', 'CONFLICT');
    }
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      name: input.name,
      sku,
      description: input.description ?? null,
      unit: input.unit ?? null,
      price: parseMoney(input.price),
      categoryId: input.categoryId ?? null,
      ...(input.status ? { status: input.status } : {}),
    },
    include: {
      category: { select: { id: true, name: true } },
      inventory: { select: { quantity: true, lowStockThreshold: true } },
    },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'product.updated',
    entity: 'Product',
    entityId: productId,
  });

  return mapProduct(updated);
}

export async function deactivateProduct(
  businessId: string,
  actorId: string,
  productId: string
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, businessId },
  });
  if (!existing) {
    throw new AppError(404, 'Product not found.', 'NOT_FOUND');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { status: 'INACTIVE' },
    include: {
      category: { select: { id: true, name: true } },
      inventory: { select: { quantity: true, lowStockThreshold: true } },
    },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'product.deactivated',
    entity: 'Product',
    entityId: productId,
  });

  return mapProduct(updated);
}
