import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as expenseApi from '../services/expenseService';
import type { Expense, ExpenseCategory } from '../services/expenseService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import './ExpensesPage.css';

type ExpenseForm = {
  title: string;
  amount: string;
  expenseDate: string;
  categoryId: string;
  notes: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const emptyForm = (): ExpenseForm => ({
  title: '',
  amount: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  categoryId: '',
  notes: '',
  status: 'ACTIVE',
});

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { path?: string; message?: string }[]) {
    if (item.path && item.message) next[item.path] = item.message;
  }
  return next;
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
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [categoryName, setCategoryName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Expense | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(async () => {
    if (!canView) {
      setError('You do not have permission to view expenses.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [expenseResult, categoryResult] = await Promise.all([
        expenseApi.listExpenses({
          search: debouncedSearch || undefined,
          status,
          categoryId: categoryFilter || undefined,
          page,
          pageSize: 20,
        }),
        expenseApi.listExpenseCategories(true),
      ]);
      setExpenses(expenseResult.items);
      setPagination(expenseResult.pagination);
      setCategories(categoryResult.categories);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, status, categoryFilter, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories]
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setForm({
      title: expense.title,
      amount: String(expense.amount),
      expenseDate: new Date(expense.expenseDate).toISOString().slice(0, 10),
      categoryId: expense.categoryId || '',
      notes: expense.notes || '',
      status: expense.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  async function onSaveExpense(event: FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      setFieldErrors({ amount: 'Enter an amount greater than zero.' });
      return;
    }

    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const payload = {
        title: form.title,
        amount,
        expenseDate: form.expenseDate,
        categoryId: form.categoryId || undefined,
        notes: form.notes || undefined,
        ...(editing ? { status: form.status } : {}),
      };
      if (editing) {
        await expenseApi.updateExpense(editing.id, payload);
        pushToast('Expense updated.', 'success');
      } else {
        await expenseApi.createExpense(payload);
        pushToast('Expense recorded.', 'success');
      }
      setModalOpen(false);
      setLoading(true);
      await loadData();
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

  async function onSaveCategory(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await expenseApi.createExpenseCategory({ name: categoryName });
      pushToast('Category created.', 'success');
      setCategoryModalOpen(false);
      setCategoryName('');
      await loadData();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to create category.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await expenseApi.deactivateExpense(deactivateTarget.id);
      pushToast('Expense deactivated.', 'success');
      setDeactivateTarget(null);
      await loadData();
    } catch (err) {
      pushToast(
        err instanceof ApiClientError ? err.message : 'Unable to deactivate expense.',
        'error'
      );
    } finally {
      setDeactivating(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view expenses.</Alert>;
  }

  return (
    <div className="expenses-page">
      <PageHeader
        title="Expenses"
        subtitle="Record and categorize business expenses."
        actions={
          <>
            {canCreate ? (
              <Button variant="secondary" onClick={() => setCategoryModalOpen(true)}>
                Add category
              </Button>
            ) : null}
            {canCreate ? <Button onClick={openCreate}>Add expense</Button> : null}
          </>
        }
      />

      <Card>
        <div className="expenses-toolbar">
          <Input
            label="Search"
            name="search"
            placeholder="Search title or notes"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <label className="expenses-select">
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ALL">All</option>
            </select>
          </label>
          <label className="expenses-select">
            <span>Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setPage(1);
                setCategoryFilter(e.target.value);
              }}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {!category.isActive ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <>
            <DataTable
              rows={expenses}
              rowKey={(row) => row.id}
              emptyTitle="No expenses yet"
              emptyDescription="Record your first expense to track business costs."
              columns={[
                {
                  key: 'title',
                  header: 'Expense',
                  render: (row) => (
                    <div>
                      <strong>{row.title}</strong>
                      <div className="expenses-muted">{formatDate(row.expenseDate)}</div>
                    </div>
                  ),
                },
                {
                  key: 'category',
                  header: 'Category',
                  render: (row) => row.category?.name || '—',
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  render: (row) => formatMoney(row.amount),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <Badge tone={row.status === 'ACTIVE' ? 'green' : 'neutral'}>
                      {row.status}
                    </Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row) => (
                    <div className="expenses-actions">
                      {canUpdate ? (
                        <Button variant="ghost" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                      ) : null}
                      {canDelete && row.status === 'ACTIVE' ? (
                        <Button variant="ghost" onClick={() => setDeactivateTarget(row)}>
                          Deactivate
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />

            <div className="expenses-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} expenses
              </span>
              <div className="expenses-actions">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit expense' : 'Add expense'}
        onClose={() => setModalOpen(false)}
        width="lg"
      >
        <form className="expenses-form" onSubmit={onSaveExpense} noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <div className="expenses-form__grid">
            <Input
              label="Title"
              name="title"
              value={form.title}
              onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
              error={fieldErrors.title}
              required
            />
            <Input
              label="Amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))}
              error={fieldErrors.amount}
              required
            />
            <Input
              label="Date"
              name="expenseDate"
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm((c) => ({ ...c, expenseDate: e.target.value }))}
              error={fieldErrors.expenseDate}
              required
            />
            <label className="expenses-select">
              <span>Category (optional)</span>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((c) => ({ ...c, categoryId: e.target.value }))}
              >
                <option value="">No category</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            {editing ? (
              <label className="expenses-select">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((c) => ({
                      ...c,
                      status: e.target.value as 'ACTIVE' | 'INACTIVE',
                    }))
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>
            ) : null}
            <Input
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
              error={fieldErrors.notes}
              className="expenses-form__full"
            />
          </div>
          <div className="expenses-form__actions">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Record expense'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={categoryModalOpen}
        title="Add expense category"
        onClose={() => setCategoryModalOpen(false)}
      >
        <form className="expenses-form" onSubmit={onSaveCategory} noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Input
            label="Category name"
            name="name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            error={fieldErrors.name}
            required
          />
          <div className="expenses-form__actions">
            <Button type="button" variant="secondary" onClick={() => setCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create category
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate expense?"
        confirmLabel="Deactivate"
        danger
        loading={deactivating}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => void onConfirmDeactivate()}
      >
        {deactivateTarget
          ? `${deactivateTarget.title} will be marked inactive and excluded from default lists.`
          : null}
      </ConfirmDialog>
    </div>
  );
}
