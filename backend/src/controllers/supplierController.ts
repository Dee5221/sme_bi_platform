import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { AppError } from '../lib/errors';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as supplierService from '../services/supplierService';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreateSupplierInput,
  UpdateSupplierInput,
} from '../validators/supplierValidators';

export async function listSuppliers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await supplierService.listSuppliers(businessId, {
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    status:
      req.query.status === 'ACTIVE' ||
      req.query.status === 'INACTIVE' ||
      req.query.status === 'ALL'
        ? req.query.status
        : 'ACTIVE',
    page: req.query.page ? Number(req.query.page) : 1,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
  });
  sendSuccess(res, result);
}

export async function getSupplier(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const supplier = await supplierService.getSupplier(businessId, req.params.id as string);
  sendSuccess(res, { supplier });
}

export async function createSupplier(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const supplier = await supplierService.createSupplier(
    businessId,
    req.user!.id,
    req.body as CreateSupplierInput
  );
  sendSuccess(res, { supplier }, 201, 'Supplier created.');
}

export async function updateSupplier(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const input = req.body as UpdateSupplierInput;
  if (input.status === 'INACTIVE' && !req.user!.permissions.includes('suppliers.delete')) {
    throw new AppError(403, 'You do not have permission to deactivate suppliers.', 'FORBIDDEN');
  }
  const supplier = await supplierService.updateSupplier(
    businessId,
    req.user!.id,
    req.params.id as string,
    input
  );
  sendSuccess(res, { supplier }, 200, 'Supplier updated.');
}

export async function deactivateSupplier(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const supplier = await supplierService.deactivateSupplier(
    businessId,
    req.user!.id,
    req.params.id as string
  );
  sendSuccess(res, { supplier }, 200, 'Supplier deactivated.');
}
