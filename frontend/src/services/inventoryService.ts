import { apiRequest } from '../lib/api';

export type InventoryItem = {
  id: string;
  productId: string;
  quantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string | null;
    status: string;
    price: number;
  };
};

export type StockMovement = {
  id: string;
  productId: string;
  type: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string | null;
  createdAt: string;
  product?: { id: string; name: string; sku: string };
  actor: { id: string; name: string } | null;
};

type Paginated<T> = {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function listInventory(params: {
  search?: string;
  lowStockOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.lowStockOnly) query.set('lowStockOnly', 'true');
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<Paginated<InventoryItem>>(`/api/inventory${suffix}`);
}

export function listMovements(params: {
  productId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.productId) query.set('productId', params.productId);
  if (params.type) query.set('type', params.type);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<Paginated<StockMovement>>(`/api/inventory/movements${suffix}`);
}

export function stockIn(payload: { productId: string; quantity: number; reason?: string }) {
  return apiRequest<{ inventory: InventoryItem; movement: StockMovement }>(
    '/api/inventory/stock-in',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function stockOut(payload: { productId: string; quantity: number; reason?: string }) {
  return apiRequest<{ inventory: InventoryItem; movement: StockMovement }>(
    '/api/inventory/stock-out',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function updateThreshold(inventoryId: string, lowStockThreshold: number) {
  return apiRequest<{ inventory: InventoryItem }>(`/api/inventory/${inventoryId}/threshold`, {
    method: 'PUT',
    body: JSON.stringify({ lowStockThreshold }),
  });
}
