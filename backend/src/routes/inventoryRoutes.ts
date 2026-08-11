import { Router } from 'express';
import * as inventoryController from '../controllers/inventoryController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  stockAdjustSchema,
  updateThresholdSchema,
} from '../validators/inventoryValidators';

export const inventoryRouter = Router();

inventoryRouter.use(authenticate);

inventoryRouter.get(
  '/',
  requirePermissions('inventory.view'),
  asyncHandler(inventoryController.listInventory)
);

inventoryRouter.get(
  '/movements',
  requirePermissions('inventory.view'),
  asyncHandler(inventoryController.listMovements)
);

inventoryRouter.post(
  '/stock-in',
  requirePermissions('inventory.adjust'),
  validateBody(stockAdjustSchema),
  asyncHandler(inventoryController.stockIn)
);

inventoryRouter.post(
  '/stock-out',
  requirePermissions('inventory.adjust'),
  validateBody(stockAdjustSchema),
  asyncHandler(inventoryController.stockOut)
);

inventoryRouter.put(
  '/:id/threshold',
  requirePermissions('inventory.adjust'),
  validateBody(updateThresholdSchema),
  asyncHandler(inventoryController.updateThreshold)
);
