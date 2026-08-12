import { Router } from 'express';
import * as auditLogController from '../controllers/auditLogController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const auditLogRouter = Router();

auditLogRouter.use(authenticate);

auditLogRouter.get(
  '/',
  requirePermissions('audit.view'),
  asyncHandler(auditLogController.listAuditLogs)
);
