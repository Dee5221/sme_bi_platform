import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { AppError } from '../lib/errors';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as productService from '../services/productService';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreateProductInput,
  UpdateProductInput,
} from '../validators/productValidators';

export async function listProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await productService.listProducts(businessId, {
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    status:
      req.query.status === 'ACTIVE' ||
      req.query.status === 'INACTIVE' ||
      req.query.status === 'ALL'
        ? req.query.status
        : 'ACTIVE',
    categoryId:
      typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
  });
  sendSuccess(res, result);
}

export async function getProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const product = await productService.getProduct(businessId, req.params.id as string);
  sendSuccess(res, { product });
}

export async function createProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const product = await productService.createProduct(
    businessId,
    req.user!.id,
    req.body as CreateProductInput
  );
  sendSuccess(res, { product }, 201, 'Product created.');
}

export async function updateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const input = req.body as UpdateProductInput;
  if (input.status === 'INACTIVE' && !req.user!.permissions.includes('products.delete')) {
    throw new AppError(403, 'You do not have permission to deactivate products.', 'FORBIDDEN');
  }
  const product = await productService.updateProduct(
    businessId,
    req.user!.id,
    req.params.id as string,
    input
  );
  sendSuccess(res, { product }, 200, 'Product updated.');
}

export async function deactivateProduct(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const product = await productService.deactivateProduct(
    businessId,
    req.user!.id,
    req.params.id as string
  );
  sendSuccess(res, { product }, 200, 'Product deactivated.');
}

export async function updateProductImage(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  if (!req.file) {
    throw new AppError(400, 'Please choose an image to upload.', 'FILE_REQUIRED');
  }
  const product = await productService.updateProductImage(
    businessId,
    req.user!.id,
    req.params.id as string,
    req.file.filename
  );
  sendSuccess(res, { product }, 200, 'Product image updated.');
}
