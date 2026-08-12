import { Router } from 'express';
import * as reportsController from '../controllers/reportsController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const reportsRouter = Router();

reportsRouter.use(authenticate);

reportsRouter.get(
  '/',
  requirePermissions('reports.view'),
  asyncHandler(reportsController.getReport)
);
