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
    businessName: 'Inventory Analytics Shop',
    firstName: 'Ivy',
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
    .send({ productId: productA.body.data.product.id, quantity: 10 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', cookie)
    .send({ productId: productB.body.data.product.id, quantity: 20 });

  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({ items: [{ productId: productA.body.data.product.id, quantity: 8 }] });

  await request(app)
    .post('/api/inventory/stock-out')
    .set('Cookie', cookie)
    .send({ productId: productB.body.data.product.id, quantity: 2, reason: 'Sample' });

  return {
    cookie,
    productAId: productA.body.data.product.id,
    productBId: productB.body.data.product.id,
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

describe('Inventory Analytics API', () => {
  it('returns inventory health and movement analytics from real data', async () => {
    const { cookie, productAId, productBId } = await setup('inventory-analytics1@test.local');

    const response = await request(app)
      .get('/api/analytics/inventory?months=6')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    const { analytics } = response.body.data;
    expect(analytics.summary.trackedProducts).toBe(2);
    expect(analytics.summary.totalUnitsOnHand).toBe(20);
    expect(analytics.summary.inventoryValue).toBe(560);
    expect(analytics.summary.lowStockCount).toBe(1);
    expect(analytics.summary.outOfStockCount).toBe(0);
    expect(analytics.summary.healthyStockCount).toBe(1);
    expect(analytics.summary.periodStockIn).toBe(30);
    expect(analytics.summary.periodStockOut).toBe(10);
    expect(analytics.summary.netMovement).toBe(20);
    expect(analytics.monthlyTrend).toHaveLength(6);
    expect(analytics.lowStockProducts).toHaveLength(1);
    expect(analytics.lowStockProducts[0].productId).toBe(productAId);
    expect(analytics.topStockInProducts[0].productId).toBe(productBId);
    expect(analytics.topStockOutProducts[0].productId).toBe(productAId);
    expect(analytics.movementBreakdown.stockInUnits).toBe(30);
    expect(analytics.movementBreakdown.stockOutUnits).toBe(10);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/analytics/inventory');
    expect(response.status).toBe(401);
  });

  it('isolates inventory analytics data by business', async () => {
    const a = await setup('inventoryAnalyticsA@test.local');
    await setup('inventoryAnalyticsB@test.local');

    const response = await request(app)
      .get('/api/analytics/inventory')
      .set('Cookie', a.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.analytics.summary.trackedProducts).toBe(2);
    expect(response.body.data.analytics.summary.totalUnitsOnHand).toBe(20);
  });
});
