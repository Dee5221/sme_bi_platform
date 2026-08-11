import { Router } from 'express';
import * as supplierController from '../controllers/supplierController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createSupplierSchema,
  updateSupplierSchema,
} from '../validators/supplierValidators';

export const supplierRouter = Router();

supplierRouter.use(authenticate);

supplierRouter.get(
  '/',
  requirePermissions('suppliers.view'),
  asyncHandler(supplierController.listSuppliers)
);

supplierRouter.get(
  '/:id',
  requirePermissions('suppliers.view'),
  asyncHandler(supplierController.getSupplier)
);

supplierRouter.post(
  '/',
  requirePermissions('suppliers.create'),
  validateBody(createSupplierSchema),
  asyncHandler(supplierController.createSupplier)
);

supplierRouter.put(
  '/:id',
  requirePermissions('suppliers.update'),
  validateBody(updateSupplierSchema),
  asyncHandler(supplierController.updateSupplier)
);

supplierRouter.delete(
  '/:id',
  requirePermissions('suppliers.delete'),
  asyncHandler(supplierController.deactivateSupplier)
);
