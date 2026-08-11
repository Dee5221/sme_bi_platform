import { Router } from 'express';
import * as saleController from '../controllers/saleController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { createSaleSchema } from '../validators/saleValidators';

export const saleRouter = Router();

saleRouter.use(authenticate);

saleRouter.get(
  '/',
  requirePermissions('sales.view'),
  asyncHandler(saleController.listSales)
);

saleRouter.get(
  '/:id',
  requirePermissions('sales.view'),
  asyncHandler(saleController.getSale)
);

saleRouter.post(
  '/',
  requirePermissions('sales.create'),
  validateBody(createSaleSchema),
  asyncHandler(saleController.createSale)
);
