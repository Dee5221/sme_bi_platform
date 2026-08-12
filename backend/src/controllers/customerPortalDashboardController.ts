import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getPortalCustomerContextOrThrow } from '../middleware/auth';
import * as customerPortalDashboardService from '../services/customerPortalDashboardService';
import { AuthenticatedRequest } from '../types/auth';

export async function getCustomerPortalDashboard(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, customerId } = getPortalCustomerContextOrThrow(req);
  const dashboard = await customerPortalDashboardService.getCustomerPortalDashboard(
    businessId,
    customerId
  );
  sendSuccess(res, { dashboard });
}
