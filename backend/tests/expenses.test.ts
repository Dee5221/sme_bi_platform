import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { ensureOwnerManagerRole } from '../src/services/authService';

const app = createApp();

async function resetDb() {
  await prisma.auditLog.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await ensureOwnerManagerRole();
}

async function register(email: string) {
  const response = await request(app).post('/api/auth/register').send({
    businessName: 'Expense Shop',
    firstName: 'Exp',
    lastName: 'Owner',
    email,
    password: 'SecurePass1',
  });
  return response.headers['set-cookie'] as string[];
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-123456';
  process.env.NODE_ENV = 'test';
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Expenses API', () => {
  it('creates category and expense for the business', async () => {
    const cookie = await register('exp1@test.local');

    const category = await request(app)
      .post('/api/expenses/categories')
      .set('Cookie', cookie)
      .send({ name: 'Utilities' });

    expect(category.status).toBe(201);

    const expense = await request(app)
      .post('/api/expenses')
      .set('Cookie', cookie)
      .send({
        title: 'Electricity bill',
        amount: 150.75,
        expenseDate: '2026-08-01',
        categoryId: category.body.data.category.id,
      });

    expect(expense.status).toBe(201);
    expect(expense.body.data.expense.amount).toBe(150.75);
    expect(expense.body.data.expense.category.name).toBe('Utilities');
  });

  it('allows expenses without a category', async () => {
    const cookie = await register('exp2@test.local');

    const expense = await request(app)
      .post('/api/expenses')
      .set('Cookie', cookie)
      .send({
        title: 'Miscellaneous',
        amount: 20,
        expenseDate: '2026-08-02',
      });

    expect(expense.status).toBe(201);
    expect(expense.body.data.expense.categoryId).toBeNull();
  });

  it('prevents cross-business expense access', async () => {
    const cookieA = await register('expA@test.local');
    const cookieB = await register('expB@test.local');

    const created = await request(app)
      .post('/api/expenses')
      .set('Cookie', cookieA)
      .send({
        title: 'Only A',
        amount: 10,
        expenseDate: '2026-08-03',
      });

    const forbidden = await request(app)
      .get(`/api/expenses/${created.body.data.expense.id}`)
      .set('Cookie', cookieB);

    expect(forbidden.status).toBe(404);
  });

  it('deactivates an expense', async () => {
    const cookie = await register('exp3@test.local');
    const created = await request(app)
      .post('/api/expenses')
      .set('Cookie', cookie)
      .send({
        title: 'Temp',
        amount: 5,
        expenseDate: '2026-08-04',
      });

    const deactivated = await request(app)
      .delete(`/api/expenses/${created.body.data.expense.id}`)
      .set('Cookie', cookie);

    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.expense.status).toBe('INACTIVE');
  });
});
