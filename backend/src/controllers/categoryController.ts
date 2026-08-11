import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as categoryService from '../services/categoryService';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../validators/productValidators';

export async function listCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const includeInactive = req.query.includeInactive === 'true';
  const categories = await categoryService.listCategories(businessId, includeInactive);
  sendSuccess(res, { categories });
}

export async function createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const category = await categoryService.createCategory(
    businessId,
    req.user!.id,
    req.body as CreateCategoryInput
  );
  sendSuccess(res, { category }, 201, 'Category created.');
}

export async function updateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const category = await categoryService.updateCategory(
    businessId,
    req.user!.id,
    req.params.id as string,
    req.body as UpdateCategoryInput
  );
  sendSuccess(res, { category }, 200, 'Category updated.');
}

export async function deactivateCategory(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const category = await categoryService.deactivateCategory(
    businessId,
    req.user!.id,
    req.params.id as string
  );
  sendSuccess(res, { category }, 200, 'Category deactivated.');
}
