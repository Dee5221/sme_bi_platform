import { apiRequest } from '../lib/api';

export type SuppliedProductSummary = {
  productId: string;
  name: string;
  sku: string;
  unit: string | null;
  totalUnitsSupplied: number;
  supplyRecordCount: number;
  lastSuppliedAt: string;
};

export type SuppliedProductDetail = {
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string | null;
  };
  totalUnitsSupplied: number;
  supplyRecordCount: number;
  supplyRecords: Array<{
    id: string;
    quantity: number;
    reason: string | null;
    createdAt: string;
  }>;
};

export type SuppliedProductListResult = {
  items: SuppliedProductSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function listSuppliedProducts(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<SuppliedProductListResult>(`/api/portal/supplier/products${suffix}`);
}

export function getSuppliedProduct(productId: string) {
  return apiRequest<{ product: SuppliedProductDetail }>(
    `/api/portal/supplier/products/${productId}`
  );
}
