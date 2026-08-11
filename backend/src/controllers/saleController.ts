import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as saleService from '../services/saleService';
import { AuthenticatedRequest } from '../types/auth';
import { CreateSaleInput } from '../validators/saleValidators';

export async function listSales(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await saleService.listSales(businessId, {
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    customerId:
      typeof req.query.customerId === 'string' ? req.query.customerId : undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
  });
  sendSuccess(res, result);
}

export async function getSale(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const sale = await saleService.getSale(businessId, req.params.id as string);
  sendSuccess(res, { sale });
}

export async function createSale(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const sale = await saleService.createSale(
    businessId,
    req.user!.id,
    req.body as CreateSaleInput
  );
  sendSuccess(res, { sale }, 201, 'Sale recorded.');
}
