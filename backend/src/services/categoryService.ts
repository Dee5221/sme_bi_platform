import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { CreateCategoryInput, UpdateCategoryInput } from '../validators/productValidators';

export const DEFAULT_PRODUCT_CATEGORIES = [
  { name: 'Grocery', description: 'Food staples, household groceries, and daily essentials.' },
  { name: 'Technology', description: 'Phones, computers, accessories, and tech gadgets.' },
  { name: 'Clothing', description: 'Apparel, fashion, and wearable accessories.' },
  { name: 'Food & Beverages', description: 'Prepared foods, snacks, drinks, and catering items.' },
  { name: 'Health & Beauty', description: 'Personal care, cosmetics, and wellness products.' },
  { name: 'Home & Living', description: 'Furniture, decor, kitchenware, and home goods.' },
  { name: 'Office Supplies', description: 'Stationery, printers, and workplace essentials.' },
  { name: 'Electronics', description: 'TVs, appliances, audio equipment, and electronics.' },
  { name: 'Hardware & Tools', description: 'Building materials, tools, and hardware supplies.' },
  { name: 'Agriculture', description: 'Farm inputs, seeds, feed, and agri-equipment.' },
  { name: 'Automotive', description: 'Vehicle parts, oils, and automotive accessories.' },
  { name: 'Sports & Outdoors', description: 'Sporting goods, fitness, and outdoor gear.' },
  { name: 'Baby & Kids', description: 'Baby care, toys, and children’s products.' },
  { name: 'Services', description: 'Service-based offerings and non-stock items.' },
  { name: 'Other', description: 'General products that do not fit other categories.' },
] as const;

export async function ensureDefaultProductCategories(businessId: string) {
  const existing = await prisma.productCategory.findMany({
    where: { businessId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((item) => item.name.toLowerCase()));

  const missing = DEFAULT_PRODUCT_CATEGORIES.filter(
    (category) => !existingNames.has(category.name.toLowerCase())
  );

  if (missing.length === 0) {
    return { created: 0, total: existing.length };
  }

  await prisma.productCategory.createMany({
    data: missing.map((category) => ({
      businessId,
      name: category.name,
      description: category.description,
      isActive: true,
    })),
  });

  return {
    created: missing.length,
    total: existing.length + missing.length,
  };
}

function mapCategory(category: {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { products: number };
}) {
  return {
    id: category.id,
    businessId: category.businessId,
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    productCount: category._count?.products ?? undefined,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export async function listCategories(businessId: string, includeInactive = false) {
  const categories = await prisma.productCategory.findMany({
    where: {
      businessId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  });
  return categories.map(mapCategory);
}

export async function createCategory(
  businessId: string,
  actorId: string,
  input: CreateCategoryInput
) {
  const existing = await prisma.productCategory.findFirst({
    where: {
      businessId,
      name: { equals: input.name },
    },
  });
  if (existing) {
    throw new AppError(409, 'A category with this name already exists.', 'CONFLICT');
  }

  const category = await prisma.productCategory.create({
    data: {
      businessId,
      name: input.name,
      description: input.description ?? null,
    },
    include: { _count: { select: { products: true } } },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'category.created',
    entity: 'ProductCategory',
    entityId: category.id,
  });

  return mapCategory(category);
}

export async function updateCategory(
  businessId: string,
  actorId: string,
  categoryId: string,
  input: UpdateCategoryInput
) {
  const category = await prisma.productCategory.findFirst({
    where: { id: categoryId, businessId },
  });
  if (!category) {
    throw new AppError(404, 'Category not found.', 'NOT_FOUND');
  }

  if (input.name && input.name !== category.name) {
    const conflict = await prisma.productCategory.findFirst({
      where: {
        businessId,
        name: input.name,
        NOT: { id: categoryId },
      },
    });
    if (conflict) {
      throw new AppError(409, 'A category with this name already exists.', 'CONFLICT');
    }
  }

  const updated = await prisma.productCategory.update({
    where: { id: categoryId },
    data: {
      name: input.name,
      description: input.description ?? null,
      ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
    },
    include: { _count: { select: { products: true } } },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'category.updated',
    entity: 'ProductCategory',
    entityId: categoryId,
  });

  return mapCategory(updated);
}

export async function deactivateCategory(
  businessId: string,
  actorId: string,
  categoryId: string
) {
  const category = await prisma.productCategory.findFirst({
    where: { id: categoryId, businessId },
  });
  if (!category) {
    throw new AppError(404, 'Category not found.', 'NOT_FOUND');
  }

  const updated = await prisma.productCategory.update({
    where: { id: categoryId },
    data: { isActive: false },
    include: { _count: { select: { products: true } } },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'category.deactivated',
    entity: 'ProductCategory',
    entityId: categoryId,
  });

  return mapCategory(updated);
}
