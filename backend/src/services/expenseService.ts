import { Prisma } from '@prisma/client';
import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { parseMoney, toMoneyNumber } from '../lib/money';
import { prisma } from '../lib/prisma';
import {
  CreateExpenseInput,
  UpdateExpenseInput,
} from '../validators/expenseValidators';

export type ExpenseListQuery = {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  categoryId?: string;
  page?: number;
  pageSize?: number;
};

function mapExpense(expense: {
  id: string;
  businessId: string;
  categoryId: string | null;
  createdById: string | null;
  title: string;
  amount: Prisma.Decimal;
  expenseDate: Date;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  category?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
}) {
  return {
    id: expense.id,
    businessId: expense.businessId,
    categoryId: expense.categoryId,
    createdById: expense.createdById,
    title: expense.title,
    amount: toMoneyNumber(expense.amount),
    expenseDate: expense.expenseDate,
    notes: expense.notes,
    status: expense.status,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
    category: expense.category
      ? { id: expense.category.id, name: expense.category.name }
      : null,
    createdBy: expense.createdBy
      ? {
          id: expense.createdBy.id,
          name: `${expense.createdBy.firstName} ${expense.createdBy.lastName}`,
        }
      : null,
  };
}

async function assertCategory(businessId: string, categoryId?: string) {
  if (!categoryId) return;
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, businessId, isActive: true },
  });
  if (!category) {
    throw new AppError(400, 'Selected expense category is invalid.', 'INVALID_CATEGORY');
  }
}

export async function listExpenses(businessId: string, query: ExpenseListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const status = query.status ?? 'ACTIVE';

  const where: Prisma.ExpenseWhereInput = {
    businessId,
    ...(status !== 'ALL' ? { status } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search } },
            { notes: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [total, expenses] = await prisma.$transaction([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: expenses.map(mapExpense),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getExpense(businessId: string, expenseId: string) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, businessId },
    include: {
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!expense) {
    throw new AppError(404, 'Expense not found.', 'NOT_FOUND');
  }
  return mapExpense(expense);
}

export async function createExpense(
  businessId: string,
  actorId: string,
  input: CreateExpenseInput
) {
  await assertCategory(businessId, input.categoryId);

  const expense = await prisma.expense.create({
    data: {
      businessId,
      createdById: actorId,
      categoryId: input.categoryId ?? null,
      title: input.title,
      amount: parseMoney(input.amount),
      expenseDate: new Date(input.expenseDate),
      notes: input.notes ?? null,
      status: 'ACTIVE',
    },
    include: {
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'expense.created',
    entity: 'Expense',
    entityId: expense.id,
    metadata: { amount: input.amount },
  });

  return mapExpense(expense);
}

export async function updateExpense(
  businessId: string,
  actorId: string,
  expenseId: string,
  input: UpdateExpenseInput
) {
  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, businessId },
  });
  if (!existing) {
    throw new AppError(404, 'Expense not found.', 'NOT_FOUND');
  }

  await assertCategory(businessId, input.categoryId);

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      title: input.title,
      amount: parseMoney(input.amount),
      expenseDate: new Date(input.expenseDate),
      categoryId: input.categoryId ?? null,
      notes: input.notes ?? null,
      ...(input.status ? { status: input.status } : {}),
    },
    include: {
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'expense.updated',
    entity: 'Expense',
    entityId: expenseId,
  });

  return mapExpense(expense);
}

export async function deactivateExpense(
  businessId: string,
  actorId: string,
  expenseId: string
) {
  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, businessId },
  });
  if (!existing) {
    throw new AppError(404, 'Expense not found.', 'NOT_FOUND');
  }

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: { status: 'INACTIVE' },
    include: {
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'expense.deactivated',
    entity: 'Expense',
    entityId: expenseId,
  });

  return mapExpense(expense);
}
