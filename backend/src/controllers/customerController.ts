import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { AppError } from '../lib/errors';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as customerService from '../services/customerService';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
} from '../validators/customerValidators';

export async function listCustomers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await customerService.listCustomers(businessId, {
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

export async function getCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const customer = await customerService.getCustomer(businessId, req.params.id as string);
  sendSuccess(res, { customer });
}

export async function createCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const customer = await customerService.createCustomer(
    businessId,
    req.user!.id,
    req.body as CreateCustomerInput
  );
  sendSuccess(res, { customer }, 201, 'Customer created.');
}

export async function updateCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const input = req.body as UpdateCustomerInput;
  if (input.status === 'INACTIVE' && !req.user!.permissions.includes('customers.delete')) {
    throw new AppError(403, 'You do not have permission to deactivate customers.', 'FORBIDDEN');
  }
  const customer = await customerService.updateCustomer(
    businessId,
    req.user!.id,
    req.params.id as string,
    input
  );
  sendSuccess(res, { customer }, 200, 'Customer updated.');
}

export async function deactivateCustomer(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const customer = await customerService.deactivateCustomer(
    businessId,
    req.user!.id,
    req.params.id as string
  );
  sendSuccess(res, { customer }, 200, 'Customer deactivated.');
}
