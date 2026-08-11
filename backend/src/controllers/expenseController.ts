import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as expenseCategoryService from '../services/expenseCategoryService';
import * as expenseService from '../services/expenseService';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  UpdateExpenseInput,
} from '../validators/expenseValidators';

export async function listCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const includeInactive = req.query.includeInactive === 'true';
  const categories = await expenseCategoryService.listExpenseCategories(
    businessId,
    includeInactive
  );
  sendSuccess(res, { categories });
}

export async function createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const category = await expenseCategoryService.createExpenseCategory(
    businessId,
    req.user!.id,
    req.body as CreateExpenseCategoryInput
  );
  sendSuccess(res, { category }, 201, 'Expense category created.');
}

export async function deactivateCategory(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const category = await expenseCategoryService.deactivateExpenseCategory(
    businessId,
    req.user!.id,
    req.params.id as string
  );
  sendSuccess(res, { category }, 200, 'Expense category deactivated.');
}

export async function listExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await expenseService.listExpenses(businessId, {
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    status:
      req.query.status === 'ACTIVE' ||
      req.query.status === 'INACTIVE' ||
      req.query.status === 'ALL'
        ? req.query.status
        : 'ACTIVE',
    categoryId:
      typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
  });
  sendSuccess(res, result);
}

export async function getExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const expense = await expenseService.getExpense(businessId, req.params.id as string);
  sendSuccess(res, { expense });
}

export async function createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const expense = await expenseService.createExpense(
    businessId,
    req.user!.id,
    req.body as CreateExpenseInput
  );
  sendSuccess(res, { expense }, 201, 'Expense recorded.');
}

export async function updateExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const expense = await expenseService.updateExpense(
    businessId,
    req.user!.id,
    req.params.id as string,
    req.body as UpdateExpenseInput
  );
  sendSuccess(res, { expense }, 200, 'Expense updated.');
}

export async function deactivateExpense(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const expense = await expenseService.deactivateExpense(
    businessId,
    req.user!.id,
    req.params.id as string
  );
  sendSuccess(res, { expense }, 200, 'Expense deactivated.');
}
