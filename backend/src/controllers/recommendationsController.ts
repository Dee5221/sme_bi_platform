import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as recommendationsService from '../services/recommendationsService';
import { AuthenticatedRequest } from '../types/auth';

export async function getRecommendations(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const months = req.query.months ? Number(req.query.months) : undefined;
  const recommendations = await recommendationsService.getRecommendations(businessId, { months });
  sendSuccess(res, { recommendations });
}
