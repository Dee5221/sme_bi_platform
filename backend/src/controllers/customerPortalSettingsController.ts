import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getPortalCustomerContextOrThrow } from '../middleware/auth';
import * as customerPortalSettingsService from '../services/customerPortalSettingsService';
import { AuthenticatedRequest } from '../types/auth';
import { UpdateCustomerPortalSettingsInput } from '../validators/customerPortalValidators';

export async function getCustomerPortalSettings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, customerId } = getPortalCustomerContextOrThrow(req);
  const settings = await customerPortalSettingsService.getCustomerPortalSettings(
    businessId,
    customerId
  );
  sendSuccess(res, { settings });
}

export async function updateCustomerPortalSettings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, customerId } = getPortalCustomerContextOrThrow(req);
  const settings = await customerPortalSettingsService.updateCustomerPortalSettings(
    businessId,
    customerId,
    req.user!.id,
    req.body as UpdateCustomerPortalSettingsInput
  );
  sendSuccess(res, { settings }, 200, 'Portal settings updated.');
}
