import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as auditLogService from '../services/auditLogService';
import { AuthenticatedRequest } from '../types/auth';

export async function listAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await auditLogService.listAuditLogs(businessId, {
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    action: typeof req.query.action === 'string' ? req.query.action : undefined,
    entity: typeof req.query.entity === 'string' ? req.query.entity : undefined,
    startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
    endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
  });
  sendSuccess(res, result);
}
