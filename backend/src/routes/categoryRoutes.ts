import { Router } from 'express';
import * as categoryController from '../controllers/categoryController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../validators/productValidators';

export const categoryRouter = Router();

categoryRouter.use(authenticate);

categoryRouter.get(
  '/',
  requirePermissions('products.view'),
  asyncHandler(categoryController.listCategories)
);

categoryRouter.post(
  '/',
  requirePermissions('products.create'),
  validateBody(createCategorySchema),
  asyncHandler(categoryController.createCategory)
);

categoryRouter.put(
  '/:id',
  requirePermissions('products.update'),
  validateBody(updateCategorySchema),
  asyncHandler(categoryController.updateCategory)
);

categoryRouter.delete(
  '/:id',
  requirePermissions('products.delete'),
  asyncHandler(categoryController.deactivateCategory)
);
