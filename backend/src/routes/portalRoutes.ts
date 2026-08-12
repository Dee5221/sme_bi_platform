import { Router } from 'express';
import * as customerPortalDashboardController from '../controllers/customerPortalDashboardController';
import * as customerPortalPurchaseController from '../controllers/customerPortalPurchaseController';
import * as customerPortalSettingsController from '../controllers/customerPortalSettingsController';
import * as supplierPortalDashboardController from '../controllers/supplierPortalDashboardController';
import * as supplierPortalProductController from '../controllers/supplierPortalProductController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { updateCustomerPortalSettingsSchema } from '../validators/customerPortalValidators';

export const portalRouter = Router();

portalRouter.use(authenticate);

portalRouter.get(
  '/customer/dashboard',
  requirePermissions('dashboard.view', 'portal.purchases.view'),
  asyncHandler(customerPortalDashboardController.getCustomerPortalDashboard)
);

portalRouter.get(
  '/customer/purchases',
  requirePermissions('portal.purchases.view'),
  asyncHandler(customerPortalPurchaseController.listCustomerPurchases)
);

portalRouter.get(
  '/customer/purchases/:id',
  requirePermissions('portal.purchases.view'),
  asyncHandler(customerPortalPurchaseController.getCustomerPurchase)
);

portalRouter.get(
  '/customer/settings',
  requirePermissions('portal.settings.view'),
  asyncHandler(customerPortalSettingsController.getCustomerPortalSettings)
);

portalRouter.put(
  '/customer/settings',
  requirePermissions('portal.settings.update'),
  validateBody(updateCustomerPortalSettingsSchema),
  asyncHandler(customerPortalSettingsController.updateCustomerPortalSettings)
);

portalRouter.get(
  '/supplier/dashboard',
  requirePermissions('dashboard.view', 'portal.products.view'),
  asyncHandler(supplierPortalDashboardController.getSupplierPortalDashboard)
);

portalRouter.get(
  '/supplier/products',
  requirePermissions('portal.products.view'),
  asyncHandler(supplierPortalProductController.listSuppliedProducts)
);

portalRouter.get(
  '/supplier/products/:productId',
  requirePermissions('portal.products.view'),
  asyncHandler(supplierPortalProductController.getSuppliedProduct)
);
