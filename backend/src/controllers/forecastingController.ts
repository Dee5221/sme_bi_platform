import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as forecastingService from '../services/forecastingService';
import { AuthenticatedRequest } from '../types/auth';

export async function getForecasting(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const months = req.query.months ? Number(req.query.months) : undefined;
  const horizon = req.query.horizon ? Number(req.query.horizon) : undefined;
  const forecasting = await forecastingService.getForecasting(businessId, { months, horizon });
  sendSuccess(res, { forecasting });
}
