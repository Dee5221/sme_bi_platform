import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as adminDashboardService from '../services/adminDashboardService';
import { AuthenticatedRequest } from '../types/auth';

export async function getAdminDashboard(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const dashboard = await adminDashboardService.getAdminDashboard(businessId);
  sendSuccess(res, { dashboard });
}
