import { apiRequest } from '../lib/api';

export type InventoryItem = {
  product_id: number;
  product_name: string;
  sku: string;
  category_name: string;
  quantity_on_hand: number;
  reorder_level: number;
  stock_status: 'sufficient' | 'low_stock' | 'out_of_stock';
  updated_at: string | null;
};

export type StockMovement = {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  user_id: number;
  user_name: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reference: string | null;
  reason: string | null;
  created_at: string;
};


export function listInventory(params: {
  search?: string;
  lowStockOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.lowStockOnly) query.set('low_stock_only', 'true');
  
  const suffix = query.toString() ? `?${query.toString()}` : '';
  
  return apiRequest<InventoryItem[]>(`/api/inventory/${suffix}`).then((data) => {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    return {
      items: data,
      pagination: {
        page,
        pageSize,
        total: data.length,
        totalPages: Math.ceil(data.length / pageSize) || 1,
      },
    };
  });
}

export function listMovements(params: {
  productId?: number;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.productId) query.set('product_id', String(params.productId));
  if (params.type) query.set('movement_type', params.type);
  
  const suffix = query.toString() ? `?${query.toString()}` : '';
  
  return apiRequest<StockMovement[]>(`/api/inventory/movements${suffix}`).then((data) => {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    return {
      items: data,
      pagination: {
        page,
        pageSize,
        total: data.length,
        totalPages: Math.ceil(data.length / pageSize) || 1,
      },
    };
  });
}

export function stockIn(payload: { productId: number; quantity: number; reason?: string; reference?: string }) {
  return apiRequest<InventoryItem>(`/api/inventory/${payload.productId}/stock-in`, {
    method: 'POST',
    body: JSON.stringify({
      quantity: payload.quantity,
      reason: payload.reason,
      reference: payload.reference,
    }),
  });
}

export function stockOut(payload: { productId: number; quantity: number; reason?: string; reference?: string }) {
  return apiRequest<InventoryItem>(`/api/inventory/${payload.productId}/stock-out`, {
    method: 'POST',
    body: JSON.stringify({
      quantity: payload.quantity,
      reason: payload.reason,
      reference: payload.reference,
    }),
  });
}

export function updateThreshold(productId: number, lowStockThreshold: number) {
  return apiRequest<{ message: string; reorder_level: number }>(`/api/inventory/${productId}/threshold`, {
    method: 'PUT',
    body: JSON.stringify({ lowStockThreshold }),
  });
}