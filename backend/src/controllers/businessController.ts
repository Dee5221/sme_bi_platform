import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as businessService from '../services/businessService';
import { AuthenticatedRequest } from '../types/auth';
import { UpdateBusinessInput } from '../validators/businessValidators';

export async function getBusiness(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const business = await businessService.getBusiness(businessId);
  sendSuccess(res, { business });
}

export async function updateBusiness(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const business = await businessService.updateBusiness(
    businessId,
    req.user!.id,
    req.body as UpdateBusinessInput
  );
  sendSuccess(res, { business }, 200, 'Business settings updated.');
}
