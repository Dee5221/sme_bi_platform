import { apiRequest } from '../lib/api';

export type Expense = {
  id: number;
  business_id: number;
  user_id: number;
  date: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  notes: string | null;
};

export type ExpensePayload = {
  date: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  notes?: string;
};

export function listExpenses(): Promise<Expense[]> {
  return apiRequest<Expense[]>('/api/expenses/');
}

export function createExpense(payload: ExpensePayload): Promise<Expense> {
  return apiRequest<Expense>('/api/expenses/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateExpense(id: number, payload: Partial<ExpensePayload>): Promise<Expense> {
  return apiRequest<Expense>(`/api/expenses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteExpense(id: number): Promise<void> {
  return apiRequest<void>(`/api/expenses/${id}`, {
    method: 'DELETE',
  });
}