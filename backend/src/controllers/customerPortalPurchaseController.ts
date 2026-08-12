import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getPortalCustomerContextOrThrow } from '../middleware/auth';
import * as customerPortalPurchaseService from '../services/customerPortalPurchaseService';
import { AuthenticatedRequest } from '../types/auth';

export async function listCustomerPurchases(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, customerId } = getPortalCustomerContextOrThrow(req);
  const result = await customerPortalPurchaseService.listCustomerPurchases(
    businessId,
    customerId,
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

export async function getCustomerPurchase(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, customerId } = getPortalCustomerContextOrThrow(req);
  const purchase = await customerPortalPurchaseService.getCustomerPurchase(
    businessId,
    customerId,
    req.params.id
  );
  sendSuccess(res, { purchase });
}
