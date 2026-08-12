import { Router } from 'express';
import * as forecastingController from '../controllers/forecastingController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const forecastingRouter = Router();

forecastingRouter.use(authenticate);

forecastingRouter.get(
  '/',
  requirePermissions('forecasting.view'),
  asyncHandler(forecastingController.getForecasting)
);
