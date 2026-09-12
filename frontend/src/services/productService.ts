import { apiRequest, apiUpload } from '../lib/api';

export type ProductCategory = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount?: number;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string | null;
  imageUrl: string | null;
  price: number;
  status: 'ACTIVE' | 'INACTIVE' | string;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  inventory: { quantity: number; lowStockThreshold: number } | null;
};

export type ProductListResult = {
  items: Product[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ProductPayload = {
  name: string;
  sku: string;
  description?: string;
  unit?: string;
  price: number;
  categoryId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
};

export type CategoryPayload = {
  name: string;
  description?: string;
  isActive?: boolean;
};

export function listCategories(includeInactive = false) {
  const query = includeInactive ? '?includeInactive=true' : '';
  return apiRequest<{ categories: ProductCategory[] }>(`/api/product-categories${query}`);
}

export function createCategory(payload: CategoryPayload) {
  return apiRequest<{ category: ProductCategory }>('/api/product-categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCategory(id: string, payload: CategoryPayload) {
  return apiRequest<{ category: ProductCategory }>(`/api/product-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deactivateCategory(id: string) {
  return apiRequest<{ category: ProductCategory }>(`/api/product-categories/${id}`, {
    method: 'DELETE',
  });
}

export function listProducts(params: {
  search?: string;
  status?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.categoryId) query.set('categoryId', params.categoryId);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<ProductListResult>(`/api/products${suffix}`);
}

export function createProduct(payload: ProductPayload) {
  return apiRequest<{ product: Product }>('/api/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProduct(id: string, payload: ProductPayload) {
  return apiRequest<{ product: Product }>(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function uploadProductImage(id: string, file: File) {
  const formData = new FormData();
  formData.append('image', file);
  return apiUpload<{ product: Product }>(`/api/products/${id}/image`, formData);
}

export function deactivateProduct(id: string) {
  return apiRequest<{ product: Product }>(`/api/products/${id}`, {
    method: 'DELETE',
  });
}
