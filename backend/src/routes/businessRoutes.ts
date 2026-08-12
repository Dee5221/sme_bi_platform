import { Router } from 'express';
import * as businessController from '../controllers/businessController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { updateBusinessSchema } from '../validators/businessValidators';

export const businessRouter = Router();

businessRouter.use(authenticate);

businessRouter.get(
  '/',
  requirePermissions('business.view'),
  asyncHandler(businessController.getBusiness)
);

businessRouter.put(
  '/',
  requirePermissions('business.update'),
  validateBody(updateBusinessSchema),
  asyncHandler(businessController.updateBusiness)
);
