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
    businessName: 'Dashboard Shop',
    firstName: 'Dash',
    lastName: 'Owner',
    email,
    password: 'SecurePass1',
  });
  const cookie = register.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name: 'Soap', sku: 'SOAP-1', price: 25 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', cookie)
    .send({ productId: product.body.data.product.id, quantity: 4 });

  // Default threshold is 5, so remaining stock after this sale will be low.
  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({ items: [{ productId: product.body.data.product.id, quantity: 2 }] });

  await request(app)
    .post('/api/expenses')
    .set('Cookie', cookie)
    .send({
      title: 'Transport',
      amount: 40,
      expenseDate: new Date().toISOString().slice(0, 10),
    });

  return { cookie };
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

describe('Dashboard API', () => {
  it('returns period KPIs from real operational data', async () => {
    const { cookie } = await setup('dash1@test.local');

    const response = await request(app).get('/api/dashboard').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.dashboard.kpis.revenue).toBe(50);
    expect(response.body.data.dashboard.kpis.expenses).toBe(40);
    expect(response.body.data.dashboard.kpis.activeProducts).toBe(1);
    expect(response.body.data.dashboard.kpis.lowStockCount).toBe(1);
    expect(response.body.data.dashboard.recentSales).toHaveLength(1);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/dashboard');
    expect(response.status).toBe(401);
  });

  it('isolates dashboard data by business', async () => {
    const a = await setup('dashA@test.local');
    await setup('dashB@test.local');

    const response = await request(app).get('/api/dashboard').set('Cookie', a.cookie);
    expect(response.status).toBe(200);
    expect(response.body.data.dashboard.business.name).toBe('Dashboard Shop');
    expect(response.body.data.dashboard.kpis.revenue).toBe(50);
  });
});
