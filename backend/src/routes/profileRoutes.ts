import { Router } from 'express';
import * as profileController from '../controllers/profileController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  changePasswordSchema,
  updateProfileSchema,
} from '../validators/profileValidators';

export const profileRouter = Router();

profileRouter.use(authenticate);

profileRouter.get(
  '/',
  requirePermissions('profile.view'),
  asyncHandler(profileController.getProfile)
);

profileRouter.put(
  '/',
  requirePermissions('profile.update'),
  validateBody(updateProfileSchema),
  asyncHandler(profileController.updateProfile)
);

profileRouter.put(
  '/password',
  requirePermissions('profile.update'),
  validateBody(changePasswordSchema),
  asyncHandler(profileController.changePassword)
);
