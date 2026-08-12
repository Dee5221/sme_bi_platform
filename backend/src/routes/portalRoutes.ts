import { Router } from 'express';
import * as customerPortalDashboardController from '../controllers/customerPortalDashboardController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const portalRouter = Router();

portalRouter.use(authenticate);

portalRouter.get(
  '/customer/dashboard',
  requirePermissions('dashboard.view', 'portal.purchases.view'),
  asyncHandler(customerPortalDashboardController.getCustomerPortalDashboard)
);
