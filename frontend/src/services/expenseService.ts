import { apiRequest } from '../lib/api';

export type ExpenseCategory = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  expenseCount?: number;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  expenseDate: string;
  notes: string | null;
  status: string;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
};

export type ExpensePayload = {
  title: string;
  amount: number;
  expenseDate: string;
  categoryId?: string;
  notes?: string;
  status?: 'ACTIVE' | 'INACTIVE';
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

export function listExpenseCategories(includeInactive = false) {
  const query = includeInactive ? '?includeInactive=true' : '';
  return apiRequest<{ categories: ExpenseCategory[] }>(`/api/expenses/categories${query}`);
}

export function createExpenseCategory(payload: { name: string; description?: string }) {
  return apiRequest<{ category: ExpenseCategory }>('/api/expenses/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listExpenses(params: {
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
  return apiRequest<Paginated<Expense>>(`/api/expenses${suffix}`);
}

export function createExpense(payload: ExpensePayload) {
  return apiRequest<{ expense: Expense }>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateExpense(id: string, payload: ExpensePayload) {
  return apiRequest<{ expense: Expense }>(`/api/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deactivateExpense(id: string) {
  return apiRequest<{ expense: Expense }>(`/api/expenses/${id}`, {
    method: 'DELETE',
  });
}
