import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { createUserSchema, updateUserSchema } from '../validators/userValidators';

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get(
  '/roles',
  requirePermissions('users.view'),
  asyncHandler(userController.listAssignableRoles)
);

userRouter.get(
  '/',
  requirePermissions('users.view'),
  asyncHandler(userController.listUsers)
);

userRouter.get(
  '/:id',
  requirePermissions('users.view'),
  asyncHandler(userController.getUser)
);

userRouter.post(
  '/',
  requirePermissions('users.create'),
  validateBody(createUserSchema),
  asyncHandler(userController.createUser)
);

userRouter.put(
  '/:id',
  requirePermissions('users.update'),
  validateBody(updateUserSchema),
  asyncHandler(userController.updateUser)
);

userRouter.delete(
  '/:id',
  requirePermissions('users.delete'),
  asyncHandler(userController.deactivateUser)
);
