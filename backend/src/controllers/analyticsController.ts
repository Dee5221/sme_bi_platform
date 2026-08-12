import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as analyticsService from '../services/analyticsService';
import { AuthenticatedRequest } from '../types/auth';

export async function getBusinessAnalytics(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const months = req.query.months ? Number(req.query.months) : undefined;
  const analytics = await analyticsService.getBusinessAnalytics(businessId, { months });
  sendSuccess(res, { analytics });
}

export async function getSalesAnalytics(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const months = req.query.months ? Number(req.query.months) : undefined;
  const analytics = await analyticsService.getSalesAnalytics(businessId, { months });
  sendSuccess(res, { analytics });
}

export async function getInventoryAnalytics(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const months = req.query.months ? Number(req.query.months) : undefined;
  const analytics = await analyticsService.getInventoryAnalytics(businessId, { months });
  sendSuccess(res, { analytics });
}

export async function getCustomerAnalytics(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const months = req.query.months ? Number(req.query.months) : undefined;
  const analytics = await analyticsService.getCustomerAnalytics(businessId, { months });
  sendSuccess(res, { analytics });
}
