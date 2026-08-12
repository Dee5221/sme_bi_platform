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
    businessName: 'Reports Shop',
    firstName: 'Rita',
    lastName: 'Owner',
    email,
    password: 'SecurePass1',
  });
  const cookie = register.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name: 'Binder', sku: 'BIN-1', price: 20 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', cookie)
    .send({ productId: product.body.data.product.id, quantity: 12 });

  const category = await request(app)
    .post('/api/expenses/categories')
    .set('Cookie', cookie)
    .send({ name: 'Operations' });

  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({ items: [{ productId: product.body.data.product.id, quantity: 2 }] });

  await request(app)
    .post('/api/expenses')
    .set('Cookie', cookie)
    .send({
      title: 'Courier',
      amount: 35,
      categoryId: category.body.data.category.id,
      expenseDate: new Date().toISOString().slice(0, 10),
    });

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

describe('Reports API', () => {
  it('returns a period report with sales, expenses, and inventory sections', async () => {
    const { cookie, productId } = await setup('reports1@test.local');
    const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);

    const response = await request(app)
      .get(`/api/reports?startDate=${startDate}&endDate=${endDate}`)
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    const { report } = response.body.data;
    expect(report.business.name).toBe('Reports Shop');
    expect(report.summary.totalRevenue).toBe(40);
    expect(report.summary.totalExpenses).toBe(35);
    expect(report.summary.netResult).toBe(5);
    expect(report.summary.salesCount).toBe(1);
    expect(report.sales.rows).toHaveLength(1);
    expect(report.expenses.rows).toHaveLength(1);
    expect(report.expenses.byCategory[0].categoryName).toBe('Operations');
    expect(report.inventory.rows).toHaveLength(1);
    expect(report.inventory.rows[0].quantity).toBe(10);
    expect(report.topProducts[0].productId).toBe(productId);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/reports');
    expect(response.status).toBe(401);
  });

  it('rejects invalid date ranges', async () => {
    const { cookie } = await setup('reports-invalid@test.local');

    const response = await request(app)
      .get('/api/reports?startDate=2026-08-12&endDate=2026-08-01')
      .set('Cookie', cookie);

    expect(response.status).toBe(400);
  });

  it('isolates report data by business', async () => {
    const a = await setup('reportsA@test.local');
    await setup('reportsB@test.local');

    const response = await request(app).get('/api/reports').set('Cookie', a.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.report.summary.totalRevenue).toBe(40);
    expect(response.body.data.report.business.name).toBe('Reports Shop');
  });
});
