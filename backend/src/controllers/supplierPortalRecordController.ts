import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getPortalSupplierContextOrThrow } from '../middleware/auth';
import * as supplierPortalRecordService from '../services/supplierPortalRecordService';
import { AuthenticatedRequest } from '../types/auth';

export async function listSupplierRecords(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, supplierId } = getPortalSupplierContextOrThrow(req);
  const result = await supplierPortalRecordService.listSupplierRecords(
    businessId,
    supplierId,
    {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    }
  );
  sendSuccess(res, result);
}

export async function getSupplierRecord(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, supplierId } = getPortalSupplierContextOrThrow(req);
  const record = await supplierPortalRecordService.getSupplierRecord(
    businessId,
    supplierId,
    req.params.id
  );
  sendSuccess(res, { record });
}
