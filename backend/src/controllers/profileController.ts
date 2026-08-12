import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { AppError } from '../lib/errors';
import { getBusinessIdOrThrow } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import * as profileService from '../services/profileService';
import {
  ChangePasswordInput,
  UpdateProfileInput,
} from '../validators/profileValidators';

export async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const user = await profileService.getProfile(req.user!.id, businessId);
  sendSuccess(res, { user });
}

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const user = await profileService.updateProfile(
    req.user!.id,
    businessId,
    req.body as UpdateProfileInput
  );
  sendSuccess(res, { user }, 200, 'Profile updated.');
}

export async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await profileService.changePassword(
    req.user!.id,
    businessId,
    req.body as ChangePasswordInput
  );
  sendSuccess(res, result, 200, 'Password updated.');
}

export async function updateAvatar(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  if (!req.file) {
    throw new AppError(400, 'Please choose an image to upload.', 'FILE_REQUIRED');
  }
  const user = await profileService.updateAvatar(req.user!.id, businessId, req.file.filename);
  sendSuccess(res, { user }, 200, 'Profile photo updated.');
}
