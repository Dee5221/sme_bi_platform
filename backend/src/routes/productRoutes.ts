import { Router } from 'express';
import * as productController from '../controllers/productController';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
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

productRouter.delete(
  '/:id',
  requirePermissions('products.delete'),
  asyncHandler(productController.deactivateProduct)
);
