import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as expenseApi from '../services/expenseService';
import type { Expense, ExpensePayload } from '../services/expenseService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import './ExpensesPage.css';

// Predefined categories (frontend suggestions, not backend-enforced)
const DEFAULT_CATEGORIES = [
  'Utilities',
  'Rent',
  'Transport',
  'Supplies',
  'Maintenance',
  'Salaries and Wages',
  'Marketing',
  'Other',
];

const ITEMS_PER_PAGE = 15;

type ExpenseForm = {
  date: string;
  category: string;
  description: string;
  amount: string;
  payment_method: string;
  notes: string;
};

const emptyForm: ExpenseForm = {
  date: new Date().toISOString().split('T')[0],
  category: '',
  description: '',
  amount: '',
  payment_method: '',
  notes: '',
};

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { loc?: string[]; msg?: string }[]) {
    if (item.loc && item.msg) {
      const field = item.loc[item.loc.length - 1];
      next[field] = item.msg;
    }
  }
  return next;
}

function formatCurrency(amount: number): string {
  return `K${amount.toLocaleString('en-ZM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ExpensesPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();

  const canView = hasPermission('expenses.view');
  const canCreate = hasPermission('expenses.create');
  const canUpdate = hasPermission('expenses.update');
  const canDelete = hasPermission('expenses.delete');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Search and filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadExpenses = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view expenses.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await expenseApi.listExpenses();
      setExpenses(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  // Build category options from existing records
  const availableCategories = useMemo(() => {
    const existing = new Set(expenses.map((e) => e.category));
    const all = new Set([...DEFAULT_CATEGORIES, ...existing]);
    return Array.from(all).sort();
  }, [expenses]);

  // Client-side filtering
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      // Category filter
      if (categoryFilter && expense.category !== categoryFilter) {
        return false;
      }

      // Search across category, description, payment method
      if (search) {
        const q = search.toLowerCase();
        const matchesSearch =
          expense.category.toLowerCase().includes(q) ||
          (expense.description && expense.description.toLowerCase().includes(q)) ||
          (expense.payment_method && expense.payment_method.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [expenses, search, categoryFilter]);

  // Client-side pagination
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredExpenses.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExpenses, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setForm({
      date: expense.date,
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description || '',
      payment_method: expense.payment_method || '',
      notes: expense.notes || '',
    });
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!canCreate && !editing) return;
    if (!canUpdate && editing) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const amount = parseFloat(form.amount);
      if (isNaN(amount) || amount <= 0) {
        setFieldErrors({ amount: 'Amount must be a positive number.' });
        setSaving(false);
        return;
      }

      const payload: ExpensePayload = {
        date: form.date,
        category: form.category,
        amount,
        description: form.description.trim() || '',
        payment_method: form.payment_method.trim() || '',
        notes: form.notes.trim() || '',
      };

      if (editing) {
        await expenseApi.updateExpense(editing.id, payload);
        pushToast('Expense updated.', 'success');
      } else {
        await expenseApi.createExpense(payload);
        pushToast('Expense created.', 'success');
      }

      setModalOpen(false);
      await loadExpenses();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to save expense.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    if (!canDelete) return;

    setDeleting(true);
    try {
      await expenseApi.deleteExpense(deleteTarget.id);
      pushToast('Expense deleted.', 'success');
      setDeleteTarget(null);
      await loadExpenses();
    } catch (err) {
      pushToast(
        err instanceof ApiClientError ? err.message : 'Unable to delete expense.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view expenses.</Alert>;
  }

  return (
    <div className="expenses-page">
      <PageHeader
        title="Expenses"
        subtitle="Record and manage business expenses."
        actions={canCreate ? <Button onClick={openCreate}>Add Expense</Button> : null}
      />

      {/* Search and Filter Bar */}
      <Card className="expenses-filters">
        <div className="expenses-filters__row">
          <Input
            label="Search"
            name="search"
            placeholder="Search category, description, or payment method"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '320px' }}
          />
          <div className="expenses-filters__field">
            <label className="expenses-filters__label">Category</label>
            <select
              className="expenses-filters__select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card>
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : paginatedExpenses.length === 0 ? (
          <div className="expenses-empty">
            <h3>No expenses found</h3>
            <p>
              {expenses.length === 0
                ? 'Add your first expense to start tracking business expenditures.'
                : 'No expenses match the current filters.'}
            </p>
            {canCreate && expenses.length === 0 && (
              <Button onClick={openCreate}>Add Expense</Button>
            )}
          </div>
        ) : (
          <>
            <div className="expenses-table-wrapper">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Payment Method</th>
                    <th className="expenses-table__right">Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatDate(expense.date)}</td>
                      <td>
                        <Badge tone="blue">{expense.category}</Badge>
                      </td>
                      <td>{expense.description || '—'}</td>
                      <td>{expense.payment_method || '—'}</td>
                      <td className="expenses-table__right expenses-table__bold">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td>
                        <div className="expenses-actions">
                          {canUpdate && (
                            <Button variant="ghost" onClick={() => openEdit(expense)}>
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" onClick={() => setDeleteTarget(expense)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="expenses-pagination">
                <div className="expenses-pagination__info">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredExpenses.length)} of{' '}
                  {filteredExpenses.length} expenses
                </div>
                <div className="expenses-pagination__controls">
                  <Button
                    variant="secondary"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="expenses-pagination__page">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? 'Edit Expense' : 'Add Expense'}
        onClose={() => setModalOpen(false)}
        width="md"
      >
        <form onSubmit={onSave} noValidate className="expenses-form">
          {formError && <Alert tone="error">{formError}</Alert>}

          <div className="expenses-form__row">
            <Input
              label="Expense Date"
              name="date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              error={fieldErrors.date}
              required
            />
            <div className="expenses-form__field">
              <label className="expenses-form__label">
                Category <span className="expenses-form__required">*</span>
              </label>
              <select
                className="expenses-form__select"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">Select category</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {fieldErrors.category && (
                <span className="expenses-form__error">{fieldErrors.category}</span>
              )}
            </div>
          </div>

          <Input
            label="Amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            error={fieldErrors.amount}
            placeholder="0.00"
            required
          />

          <Input
            label="Description"
            name="description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            error={fieldErrors.description}
            placeholder="Optional description"
          />

          <Input
            label="Payment Method"
            name="payment_method"
            value={form.payment_method}
            onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
            error={fieldErrors.payment_method}
            placeholder="e.g., Cash, Card, Mobile Money"
          />

          <div className="expenses-form__actions">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save Changes' : 'Create Expense'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Expense?"
        confirmLabel="Delete"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void onConfirmDelete()}
      >
        {deleteTarget && (
          <p>
            Are you sure you want to delete this expense? This action cannot be undone.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}