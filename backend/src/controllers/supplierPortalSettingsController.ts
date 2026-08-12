import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getPortalSupplierContextOrThrow } from '../middleware/auth';
import * as supplierPortalSettingsService from '../services/supplierPortalSettingsService';
import { AuthenticatedRequest } from '../types/auth';
import { UpdateSupplierPortalSettingsInput } from '../validators/supplierPortalValidators';

export async function getSupplierPortalSettings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, supplierId } = getPortalSupplierContextOrThrow(req);
  const settings = await supplierPortalSettingsService.getSupplierPortalSettings(
    businessId,
    supplierId
  );
  sendSuccess(res, { settings });
}

export async function updateSupplierPortalSettings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, supplierId } = getPortalSupplierContextOrThrow(req);
  const settings = await supplierPortalSettingsService.updateSupplierPortalSettings(
    businessId,
    supplierId,
    req.user!.id,
    req.body as UpdateSupplierPortalSettingsInput
  );
  sendSuccess(res, { settings }, 200, 'Portal settings updated.');
}
