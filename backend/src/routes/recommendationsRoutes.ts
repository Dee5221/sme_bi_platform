import { Router } from 'express';
import * as recommendationsController from '../controllers/recommendationsController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const recommendationsRouter = Router();

recommendationsRouter.use(authenticate);

recommendationsRouter.get(
  '/',
  requirePermissions('recommendations.view'),
  asyncHandler(recommendationsController.getRecommendations)
);
