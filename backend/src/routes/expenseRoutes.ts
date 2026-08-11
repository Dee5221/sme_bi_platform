import { Router } from 'express';
import * as expenseController from '../controllers/expenseController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createExpenseCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
} from '../validators/expenseValidators';

export const expenseRouter = Router();

expenseRouter.use(authenticate);

expenseRouter.get(
  '/categories',
  requirePermissions('expenses.view'),
  asyncHandler(expenseController.listCategories)
);

expenseRouter.post(
  '/categories',
  requirePermissions('expenses.create'),
  validateBody(createExpenseCategorySchema),
  asyncHandler(expenseController.createCategory)
);

expenseRouter.delete(
  '/categories/:id',
  requirePermissions('expenses.delete'),
  asyncHandler(expenseController.deactivateCategory)
);

expenseRouter.get(
  '/',
  requirePermissions('expenses.view'),
  asyncHandler(expenseController.listExpenses)
);

expenseRouter.get(
  '/:id',
  requirePermissions('expenses.view'),
  asyncHandler(expenseController.getExpense)
);

expenseRouter.post(
  '/',
  requirePermissions('expenses.create'),
  validateBody(createExpenseSchema),
  asyncHandler(expenseController.createExpense)
);

expenseRouter.put(
  '/:id',
  requirePermissions('expenses.update'),
  validateBody(updateExpenseSchema),
  asyncHandler(expenseController.updateExpense)
);

expenseRouter.delete(
  '/:id',
  requirePermissions('expenses.delete'),
  asyncHandler(expenseController.deactivateExpense)
);
