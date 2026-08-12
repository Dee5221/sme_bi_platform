import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

analyticsRouter.get(
  '/business',
  requirePermissions('analytics.view'),
  asyncHandler(analyticsController.getBusinessAnalytics)
);
