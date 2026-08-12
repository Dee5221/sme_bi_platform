import { Router } from 'express';
import * as staffDashboardController from '../controllers/staffDashboardController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const staffRouter = Router();

staffRouter.use(authenticate);

staffRouter.get(
  '/dashboard',
  requirePermissions('dashboard.view', 'sales.view'),
  asyncHandler(staffDashboardController.getStaffDashboard)
);
