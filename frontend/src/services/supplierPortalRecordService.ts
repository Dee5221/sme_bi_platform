import { apiRequest } from '../lib/api';

export type SupplierPurchaseRecord = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unit: string | null;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string | null;
  createdAt: string;
};

export type SupplierRecordListResult = {
  items: SupplierPurchaseRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function listSupplierRecords(params?: {
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<SupplierRecordListResult>(`/api/portal/supplier/records${suffix}`);
}

export function getSupplierRecord(id: string) {
  return apiRequest<{ record: SupplierPurchaseRecord }>(
    `/api/portal/supplier/records/${id}`
  );
}
