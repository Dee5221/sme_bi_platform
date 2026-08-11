import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as dashboardService from '../services/dashboardService';
import { AuthenticatedRequest } from '../types/auth';

export async function getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const dashboard = await dashboardService.getDashboard(businessId);
  sendSuccess(res, { dashboard });
}
