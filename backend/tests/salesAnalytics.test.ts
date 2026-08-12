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
    businessName: 'Sales Analytics Shop',
    firstName: 'Sam',
    lastName: 'Owner',
    email,
    password: 'SecurePass1',
  });
  const cookie = register.headers['set-cookie'] as string[];

  const productA = await request(app)
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name: 'Pen', sku: 'PEN-1', price: 10 });

  const productB = await request(app)
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name: 'Notebook', sku: 'NB-1', price: 30 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', cookie)
    .send({ productId: productA.body.data.product.id, quantity: 20 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', cookie)
    .send({ productId: productB.body.data.product.id, quantity: 20 });

  const customer = await request(app)
    .post('/api/customers')
    .set('Cookie', cookie)
    .send({ name: 'Acme Corp', email: 'acme@test.local' });

  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({
      items: [{ productId: productA.body.data.product.id, quantity: 2 }],
    });

  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({
      customerId: customer.body.data.customer.id,
      items: [{ productId: productB.body.data.product.id, quantity: 1 }],
    });

  return {
    cookie,
    productAId: productA.body.data.product.id,
    productBId: productB.body.data.product.id,
    customerId: customer.body.data.customer.id,
  };
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

describe('Sales Analytics API', () => {
  it('returns sales-focused trends and rankings from real data', async () => {
    const { cookie, productAId, productBId, customerId } = await setup('sales-analytics1@test.local');

    const response = await request(app)
      .get('/api/analytics/sales?months=6')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    const { analytics } = response.body.data;
    expect(analytics.summary.totalRevenue).toBe(50);
    expect(analytics.summary.totalSales).toBe(2);
    expect(analytics.summary.averageOrderValue).toBe(25);
    expect(analytics.summary.totalUnitsSold).toBe(3);
    expect(analytics.summary.walkInSales).toBe(1);
    expect(analytics.summary.customerLinkedSales).toBe(1);
    expect(analytics.summary.walkInRevenue).toBe(20);
    expect(analytics.summary.customerRevenue).toBe(30);
    expect(analytics.monthlyTrend).toHaveLength(6);
    expect(analytics.topProductsByRevenue[0].productId).toBe(productBId);
    expect(analytics.topProductsByQuantity[0].productId).toBe(productAId);
    expect(analytics.topCustomers).toHaveLength(1);
    expect(analytics.topCustomers[0].customerId).toBe(customerId);
    expect(analytics.topCustomers[0].revenue).toBe(30);
    expect(analytics.walkInSummary.salesCount).toBe(1);
    expect(analytics.walkInSummary.revenue).toBe(20);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/analytics/sales');
    expect(response.status).toBe(401);
  });

  it('isolates sales analytics data by business', async () => {
    const a = await setup('salesAnalyticsA@test.local');
    await setup('salesAnalyticsB@test.local');

    const response = await request(app)
      .get('/api/analytics/sales')
      .set('Cookie', a.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.analytics.summary.totalSales).toBe(2);
    expect(response.body.data.analytics.summary.totalRevenue).toBe(50);
  });
});
