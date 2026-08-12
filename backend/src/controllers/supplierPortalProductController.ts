import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getPortalSupplierContextOrThrow } from '../middleware/auth';
import * as supplierPortalProductService from '../services/supplierPortalProductService';
import { AuthenticatedRequest } from '../types/auth';

export async function listSuppliedProducts(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, supplierId } = getPortalSupplierContextOrThrow(req);
  const result = await supplierPortalProductService.listSuppliedProducts(
    businessId,
    supplierId,
    {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    }
  );
  sendSuccess(res, result);
}

export async function getSuppliedProduct(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { businessId, supplierId } = getPortalSupplierContextOrThrow(req);
  const product = await supplierPortalProductService.getSuppliedProduct(
    businessId,
    supplierId,
    req.params.productId
  );
  sendSuccess(res, { product });
}
