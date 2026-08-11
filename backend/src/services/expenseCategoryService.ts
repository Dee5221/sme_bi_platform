import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { CreateExpenseCategoryInput } from '../validators/expenseValidators';

function mapCategory(category: {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { expenses: number };
}) {
  return {
    id: category.id,
    businessId: category.businessId,
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    expenseCount: category._count?.expenses,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export async function listExpenseCategories(businessId: string, includeInactive = false) {
  const categories = await prisma.expenseCategory.findMany({
    where: {
      businessId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: { _count: { select: { expenses: true } } },
    orderBy: { name: 'asc' },
  });
  return categories.map(mapCategory);
}

export async function createExpenseCategory(
  businessId: string,
  actorId: string,
  input: CreateExpenseCategoryInput
) {
  const existing = await prisma.expenseCategory.findFirst({
    where: { businessId, name: input.name },
  });
  if (existing) {
    throw new AppError(409, 'An expense category with this name already exists.', 'CONFLICT');
  }

  const category = await prisma.expenseCategory.create({
    data: {
      businessId,
      name: input.name,
      description: input.description ?? null,
    },
    include: { _count: { select: { expenses: true } } },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'expense_category.created',
    entity: 'ExpenseCategory',
    entityId: category.id,
  });

  return mapCategory(category);
}

export async function deactivateExpenseCategory(
  businessId: string,
  actorId: string,
  categoryId: string
) {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, businessId },
  });
  if (!category) {
    throw new AppError(404, 'Expense category not found.', 'NOT_FOUND');
  }

  const updated = await prisma.expenseCategory.update({
    where: { id: categoryId },
    data: { isActive: false },
    include: { _count: { select: { expenses: true } } },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'expense_category.deactivated',
    entity: 'ExpenseCategory',
    entityId: categoryId,
  });

  return mapCategory(updated);
}
