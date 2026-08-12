import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get(
  '/',
  requirePermissions('dashboard.view', 'sales.view', 'expenses.view'),
  asyncHandler(dashboardController.getDashboard)
);
