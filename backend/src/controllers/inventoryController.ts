import { Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getBusinessIdOrThrow } from '../middleware/auth';
import * as inventoryService from '../services/inventoryService';
import { AuthenticatedRequest } from '../types/auth';
import {
  StockAdjustInput,
  UpdateThresholdInput,
} from '../validators/inventoryValidators';

export async function listInventory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await inventoryService.listInventory(businessId, {
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    lowStockOnly: req.query.lowStockOnly === 'true',
    page: req.query.page ? Number(req.query.page) : 1,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
  });
  sendSuccess(res, result);
}

export async function stockIn(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await inventoryService.adjustStock(
    businessId,
    req.user!.id,
    'STOCK_IN',
    req.body as StockAdjustInput
  );
  sendSuccess(res, result, 200, 'Stock increased.');
}

export async function stockOut(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await inventoryService.adjustStock(
    businessId,
    req.user!.id,
    'STOCK_OUT',
    req.body as StockAdjustInput
  );
  sendSuccess(res, result, 200, 'Stock decreased.');
}

export async function updateThreshold(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const inventory = await inventoryService.updateLowStockThreshold(
    businessId,
    req.user!.id,
    req.params.id as string,
    req.body as UpdateThresholdInput
  );
  sendSuccess(res, { inventory }, 200, 'Low-stock threshold updated.');
}

export async function listMovements(req: AuthenticatedRequest, res: Response): Promise<void> {
  const businessId = getBusinessIdOrThrow(req);
  const result = await inventoryService.listMovements(businessId, {
    productId:
      typeof req.query.productId === 'string' ? req.query.productId : undefined,
    type:
      req.query.type === 'STOCK_IN' ||
      req.query.type === 'STOCK_OUT' ||
      req.query.type === 'ALL'
        ? req.query.type
        : 'ALL',
    page: req.query.page ? Number(req.query.page) : 1,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
  });
  sendSuccess(res, result);
}
