import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as userService from '../services/userService';
import { AuthenticatedRequest } from '../types/auth';
import { CreateUserInput, UpdateUserInput } from '../validators/userValidators';

export async function listAssignableRoles(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const roles = await userService.listAssignableRoles();
  sendSuccess(res, { roles });
}

export async function listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await userService.listUsers(businessId, {
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

export async function getUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const user = await userService.getUser(businessId, req.params.id as string);
  sendSuccess(res, { user });
}

export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const user = await userService.createUser(
    businessId,
    req.user!.id,
    req.body as CreateUserInput
  );
  sendSuccess(res, { user }, 201, 'User created.');
}

export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const user = await userService.updateUser(
    businessId,
    req.user!.id,
    req.params.id as string,
    req.body as UpdateUserInput
  );
  sendSuccess(res, { user }, 200, 'User updated.');
}

export async function deactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const user = await userService.deactivateUser(
    businessId,
    req.user!.id,
    req.params.id as string
  );
  sendSuccess(res, { user }, 200, 'User deactivated.');
}
