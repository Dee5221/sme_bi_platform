import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as reportsService from '../services/reportsService';
import { AuthenticatedRequest } from '../types/auth';

export async function getReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
  const report = await reportsService.getReport(businessId, { startDate, endDate });
  sendSuccess(res, { report });
}
