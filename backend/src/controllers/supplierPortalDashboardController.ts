import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getPortalSupplierContextOrThrow } from '../middleware/auth';
import * as supplierPortalDashboardService from '../services/supplierPortalDashboardService';
import { AuthenticatedRequest } from '../types/auth';

export async function getSupplierPortalDashboard(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, supplierId } = getPortalSupplierContextOrThrow(req);
  const dashboard = await supplierPortalDashboardService.getSupplierPortalDashboard(
    businessId,
    supplierId
  );
  sendSuccess(res, { dashboard });
}
