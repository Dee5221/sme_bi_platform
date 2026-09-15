import { apiRequest } from '../lib/api';

export type ProductCategory = {
  id: number;
  business_id: number;
  name: string;
  status: 'active' | 'inactive';
};

export type Product = {
  id: number;
  business_id: number;
  category_id: number;
  supplier_id: number | null;
  sku: string;
  name: string;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  status: 'active' | 'inactive';
  // Optional frontend-only fields for UI compatibility, populated via mapping if needed
  category?: { id: number; name: string } | null;
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
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  category_id: number;
  supplier_id?: number;
  status?: 'active' | 'inactive';
};

export type CategoryPayload = {
  name: string;
  status?: 'active' | 'inactive';
};

export function listCategories(includeInactive = false) {
  // Backend returns a flat array. We wrap it to match frontend expectations.
  return apiRequest<ProductCategory[]>('/api/categories/').then((data) => {
    const filtered = includeInactive ? data : data.filter((c) => c.status === 'active');
    return { categories: filtered };
  });
}

export function createCategory(payload: CategoryPayload) {
  return apiRequest<ProductCategory>('/api/categories/', {
    method: 'POST',
    body: JSON.stringify({ name: payload.name, status: payload.status || 'active' }),
  });
}

export function updateCategory(id: number, payload: CategoryPayload) {
  return apiRequest<ProductCategory>(`/api/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: payload.name, status: payload.status }),
  });
}

export function deactivateCategory(id: number) {
  return apiRequest<ProductCategory>(`/api/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'inactive' }),
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
  if (params.status && params.status !== 'ALL') query.set('status', params.status.toLowerCase());
  if (params.categoryId) query.set('category_id', params.categoryId);
  // Note: Backend currently returns a flat array. We simulate pagination for the UI.
  const suffix = query.toString() ? `?${query.toString()}` : '';
  
  return apiRequest<Product[]>(`/api/products/${suffix}`).then((data) => {
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

export function createProduct(payload: ProductPayload) {
  return apiRequest<Product>('/api/products/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProduct(id: number, payload: Partial<ProductPayload>) {
  return apiRequest<Product>(`/api/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deactivateProduct(id: number) {
  return apiRequest<Product>(`/api/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'inactive' }),
  });
}

// Image upload is not supported by the current backend MVP. 
// Returning a resolved promise to prevent UI crashes if called, but it won't actually upload.
export function uploadProductImage(_id: number, _file: File) {
  console.warn('Product image upload is not supported in the current backend MVP.');
  return Promise.resolve({ product: {} as Product });
}