import { Router } from 'express';
import * as customerController from '../controllers/customerController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createCustomerSchema,
  updateCustomerSchema,
} from '../validators/customerValidators';

export const customerRouter = Router();

customerRouter.use(authenticate);

customerRouter.get(
  '/',
  requirePermissions('customers.view'),
  asyncHandler(customerController.listCustomers)
);

customerRouter.get(
  '/:id',
  requirePermissions('customers.view'),
  asyncHandler(customerController.getCustomer)
);

customerRouter.post(
  '/',
  requirePermissions('customers.create'),
  validateBody(createCustomerSchema),
  asyncHandler(customerController.createCustomer)
);

customerRouter.put(
  '/:id',
  requirePermissions('customers.update'),
  validateBody(updateCustomerSchema),
  asyncHandler(customerController.updateCustomer)
);

customerRouter.delete(
  '/:id',
  requirePermissions('customers.delete'),
  asyncHandler(customerController.deactivateCustomer)
);
