import { Router } from 'express';
import * as roleController from '../controllers/roleController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { updateRolePermissionsSchema } from '../validators/roleValidators';

export const roleRouter = Router();

roleRouter.use(authenticate);

roleRouter.get(
  '/',
  requirePermissions('roles.view'),
  asyncHandler(roleController.listRoles)
);

roleRouter.put(
  '/:id/permissions',
  requirePermissions('roles.manage'),
  validateBody(updateRolePermissionsSchema),
  asyncHandler(roleController.updateRolePermissions)
);
