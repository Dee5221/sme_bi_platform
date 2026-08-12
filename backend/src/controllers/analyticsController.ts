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
