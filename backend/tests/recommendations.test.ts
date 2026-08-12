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
    businessName: 'Recommendations Shop',
    firstName: 'Remy',
    lastName: 'Owner',
    email,
    password: 'SecurePass1',
  });
  const cookie = register.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name: 'Marker', sku: 'MK-1', price: 25 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', cookie)
    .send({ productId: product.body.data.product.id, quantity: 10 });

  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({ items: [{ productId: product.body.data.product.id, quantity: 8 }] });

  await request(app)
    .post('/api/expenses')
    .set('Cookie', cookie)
    .send({
      title: 'Supplies',
      amount: 300,
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

describe('Recommendations API', () => {
  it('returns rule-based recommendations from real business signals', async () => {
    const { cookie, productId } = await setup('recommendations1@test.local');

    const response = await request(app)
      .get('/api/recommendations?months=6')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    const { recommendations } = response.body.data;
    expect(recommendations.summary.total).toBeGreaterThan(0);
    expect(recommendations.recommendations.some((row: { id: string }) => row.id === `low-stock-${productId}`)).toBe(true);
    expect(recommendations.recommendations.some((row: { id: string }) => row.id === 'high-walk-in-ratio')).toBe(true);
    expect(recommendations.recommendations.some((row: { id: string }) => row.id === 'expenses-exceed-revenue-month')).toBe(true);
    expect(recommendations.summary.highPriority).toBeGreaterThan(0);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/recommendations');
    expect(response.status).toBe(401);
  });

  it('isolates recommendations by business', async () => {
    const a = await setup('recommendationsA@test.local');
    await setup('recommendationsB@test.local');

    const response = await request(app)
      .get('/api/recommendations')
      .set('Cookie', a.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.recommendations.summary.total).toBeGreaterThan(0);
  });
});
