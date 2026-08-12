import { Router } from 'express';
import * as adminDashboardController from '../controllers/adminDashboardController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const adminRouter = Router();

adminRouter.use(authenticate);

adminRouter.get(
  '/dashboard',
  requirePermissions('users.view'),
  asyncHandler(adminDashboardController.getAdminDashboard)
);
