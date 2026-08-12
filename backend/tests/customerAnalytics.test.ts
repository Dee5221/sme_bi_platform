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
    businessName: 'Customer Analytics Shop',
    firstName: 'Cara',
    lastName: 'Owner',
    email,
    password: 'SecurePass1',
  });
  const cookie = register.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name: 'Notebook', sku: 'NB-1', price: 20 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', cookie)
    .send({ productId: product.body.data.product.id, quantity: 20 });

  const customerA = await request(app)
    .post('/api/customers')
    .set('Cookie', cookie)
    .send({ name: 'Acme Corp', email: 'acme@test.local' });

  const customerB = await request(app)
    .post('/api/customers')
    .set('Cookie', cookie)
    .send({ name: 'Beta LLC', email: 'beta@test.local' });

  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({
      customerId: customerA.body.data.customer.id,
      items: [{ productId: product.body.data.product.id, quantity: 1 }],
    });

  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({
      customerId: customerA.body.data.customer.id,
      items: [{ productId: product.body.data.product.id, quantity: 2 }],
    });

  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({
      customerId: customerB.body.data.customer.id,
      items: [{ productId: product.body.data.product.id, quantity: 1 }],
    });

  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({ items: [{ productId: product.body.data.product.id, quantity: 1 }] });

  return {
    cookie,
    customerAId: customerA.body.data.customer.id,
    customerBId: customerB.body.data.customer.id,
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

describe('Customer Analytics API', () => {
  it('returns customer growth and purchase analytics from real data', async () => {
    const { cookie, customerAId, customerBId } = await setup('customer-analytics1@test.local');

    const response = await request(app)
      .get('/api/analytics/customers?months=6')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    const { analytics } = response.body.data;
    expect(analytics.summary.activeCustomers).toBe(2);
    expect(analytics.summary.newCustomersInPeriod).toBe(2);
    expect(analytics.summary.customersWithSalesInPeriod).toBe(2);
    expect(analytics.summary.customerLinkedSales).toBe(3);
    expect(analytics.summary.walkInSales).toBe(1);
    expect(analytics.summary.customerRevenue).toBe(80);
    expect(analytics.summary.walkInRevenue).toBe(20);
    expect(analytics.summary.repeatCustomersInPeriod).toBe(1);
    expect(analytics.summary.oneTimeCustomersInPeriod).toBe(1);
    expect(analytics.summary.averageRevenuePerCustomer).toBe(40);
    expect(analytics.monthlyTrend).toHaveLength(6);
    expect(analytics.topCustomersByRevenue[0].customerId).toBe(customerAId);
    expect(analytics.topCustomersByRevenue[0].revenue).toBe(60);
    expect(analytics.topCustomersBySalesCount[0].customerId).toBe(customerAId);
    expect(analytics.topCustomersBySalesCount[0].salesCount).toBe(2);
    expect(analytics.walkInSummary.salesCount).toBe(1);
    expect(analytics.customerMix.repeatCustomers).toBe(1);
    expect(analytics.customerMix.oneTimeCustomers).toBe(1);
    expect(analytics.topCustomersByRevenue.some((c: { customerId: string }) => c.customerId === customerBId)).toBe(true);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/analytics/customers');
    expect(response.status).toBe(401);
  });

  it('isolates customer analytics data by business', async () => {
    const a = await setup('customerAnalyticsA@test.local');
    await setup('customerAnalyticsB@test.local');

    const response = await request(app)
      .get('/api/analytics/customers')
      .set('Cookie', a.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.analytics.summary.activeCustomers).toBe(2);
    expect(response.body.data.analytics.summary.customerLinkedSales).toBe(3);
  });
});
