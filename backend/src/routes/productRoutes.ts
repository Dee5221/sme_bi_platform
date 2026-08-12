import { Router } from 'express';
import * as productController from '../controllers/productController';
import { AppError } from '../lib/errors';
import { authenticate, requirePermissions } from '../middleware/auth';
import {
  handleUploadErrors,
  productImageUpload,
  requireUploadedImage,
} from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { AuthenticatedRequest } from '../types/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createProductSchema,
  updateProductSchema,
} from '../validators/productValidators';

export const productRouter = Router();

productRouter.use(authenticate);

productRouter.get(
  '/',
  requirePermissions('products.view'),
  asyncHandler(productController.listProducts)
);

productRouter.get(
  '/:id',
  requirePermissions('products.view'),
  asyncHandler(productController.getProduct)
);

productRouter.post(
  '/',
  requirePermissions('products.create'),
  validateBody(createProductSchema),
  asyncHandler(productController.createProduct)
);

productRouter.put(
  '/:id',
  requirePermissions('products.update'),
  validateBody(updateProductSchema),
  asyncHandler(productController.updateProduct)
);

productRouter.post(
  '/:id/image',
  (req, _res, next) => {
    const permissions = (req as AuthenticatedRequest).user?.permissions || [];
    if (!permissions.includes('products.create') && !permissions.includes('products.update')) {
      next(
        new AppError(403, 'You do not have permission to perform this action.', 'FORBIDDEN')
      );
      return;
    }
    next();
  },
  (req, res, next) => {
    productImageUpload.single('image')(req, res, (err) => {
      if (err) {
        handleUploadErrors(err, req, res, next);
        return;
      }
      next();
    });
  },
  requireUploadedImage('image'),
  asyncHandler(productController.updateProductImage)
);

productRouter.delete(
  '/:id',
  requirePermissions('products.delete'),
  asyncHandler(productController.deactivateProduct)
);
