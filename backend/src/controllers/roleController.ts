import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as roleService from '../services/roleService';
import { AuthenticatedRequest } from '../types/auth';
import { UpdateRolePermissionsInput } from '../validators/roleValidators';

export async function listRoles(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await roleService.listRolesWithPermissions();
  sendSuccess(res, result);
}

export async function updateRolePermissions(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const role = await roleService.updateRolePermissions(
    businessId,
    req.user!.id,
    req.params.id as string,
    req.body as UpdateRolePermissionsInput
  );
  sendSuccess(res, { role }, 200, 'Role permissions updated.');
}
