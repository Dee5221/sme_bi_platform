import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as staffDashboardService from '../services/staffDashboardService';
import { AuthenticatedRequest } from '../types/auth';

export async function getStaffDashboard(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const dashboard = await staffDashboardService.getStaffDashboard(businessId);
  sendSuccess(res, { dashboard });
}
