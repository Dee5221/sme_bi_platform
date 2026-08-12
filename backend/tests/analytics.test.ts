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

async function setup(email: string) {
  const register = await request(app).post('/api/auth/register').send({
    businessName: 'Analytics Shop',
    firstName: 'Ana',
    lastName: 'Owner',
    email,
    password: 'SecurePass1',
  });
  const cookie = register.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name: 'Notebook', sku: 'NB-1', price: 30 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', cookie)
    .send({ productId: product.body.data.product.id, quantity: 10 });

  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({ items: [{ productId: product.body.data.product.id, quantity: 2 }] });

  const category = await request(app)
    .post('/api/expenses/categories')
    .set('Cookie', cookie)
    .send({ name: 'Utilities' });

  await request(app)
    .post('/api/expenses')
    .set('Cookie', cookie)
    .send({
      title: 'Electricity',
      amount: 55,
      categoryId: category.body.data.category.id,
      expenseDate: new Date().toISOString().slice(0, 10),
    });

  await request(app)
    .post('/api/customers')
    .set('Cookie', cookie)
    .send({ name: 'Acme Corp', email: 'acme@test.local' });

  return { cookie, productId: product.body.data.product.id };
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

describe('Business Analytics API', () => {
  it('returns aggregated trends and breakdowns from real data', async () => {
    const { cookie, productId } = await setup('analytics1@test.local');

    const response = await request(app)
      .get('/api/analytics/business?months=6')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    const { analytics } = response.body.data;
    expect(analytics.summary.totalRevenue).toBe(60);
    expect(analytics.summary.totalExpenses).toBe(55);
    expect(analytics.summary.netResult).toBe(5);
    expect(analytics.summary.totalSales).toBe(1);
    expect(analytics.summary.activeCustomers).toBe(1);
    expect(analytics.summary.activeProducts).toBe(1);
    expect(analytics.monthlyTrend).toHaveLength(6);
    expect(analytics.topProducts).toHaveLength(1);
    expect(analytics.topProducts[0].productId).toBe(productId);
    expect(analytics.topProducts[0].revenue).toBe(60);
    expect(analytics.expensesByCategory).toHaveLength(1);
    expect(analytics.expensesByCategory[0].categoryName).toBe('Utilities');
    expect(analytics.expensesByCategory[0].amount).toBe(55);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/analytics/business');
    expect(response.status).toBe(401);
  });

  it('isolates analytics data by business', async () => {
    const a = await setup('analyticsA@test.local');
    await setup('analyticsB@test.local');

    const response = await request(app)
      .get('/api/analytics/business')
      .set('Cookie', a.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.analytics.summary.totalRevenue).toBe(60);
    expect(response.body.data.analytics.summary.activeCustomers).toBe(1);
  });
});
