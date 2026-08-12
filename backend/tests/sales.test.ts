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
    businessName: 'Sales Shop',
    firstName: 'Sam',
    lastName: 'Owner',
    email,
    password: 'SecurePass1',
  });
  const cookie = register.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name: 'Bread', sku: 'BRD-1', price: 10 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', cookie)
    .send({ productId: product.body.data.product.id, quantity: 50 });

  const customer = await request(app)
    .post('/api/customers')
    .set('Cookie', cookie)
    .send({ name: 'Walk-in Friend' });

  return {
    cookie,
    product: product.body.data.product,
    customer: customer.body.data.customer,
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

describe('Sales API', () => {
  it('creates a sale, freezes prices, and reduces inventory', async () => {
    const { cookie, product, customer } = await setup('sale1@test.local');

    const response = await request(app)
      .post('/api/sales')
      .set('Cookie', cookie)
      .send({
        customerId: customer.id,
        notes: 'Morning sale',
        items: [{ productId: product.id, quantity: 3 }],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.sale.total).toBe(30);
    expect(response.body.data.sale.items[0].unitPrice).toBe(10);
    expect(response.body.data.sale.items[0].productName).toBe('Bread');

    const inventory = await request(app).get('/api/inventory').set('Cookie', cookie);
    expect(inventory.body.data.items[0].quantity).toBe(47);

    await request(app)
      .put(`/api/products/${product.id}`)
      .set('Cookie', cookie)
      .send({
        name: 'Bread',
        sku: 'BRD-1',
        price: 99,
      });

    const sale = await request(app)
      .get(`/api/sales/${response.body.data.sale.id}`)
      .set('Cookie', cookie);
    expect(sale.body.data.sale.items[0].unitPrice).toBe(10);
  });

  it('rejects sales that would oversell stock', async () => {
    const { cookie, product } = await setup('sale2@test.local');

    const response = await request(app)
      .post('/api/sales')
      .set('Cookie', cookie)
      .send({
        items: [{ productId: product.id, quantity: 999 }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('allows walk-in sales without a customer', async () => {
    const { cookie, product } = await setup('sale3@test.local');

    const response = await request(app)
      .post('/api/sales')
      .set('Cookie', cookie)
      .send({
        items: [{ productId: product.id, quantity: 2 }],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.sale.customerId).toBeNull();
  });

  it('filters sales by soldAt date range', async () => {
    const { cookie, product } = await setup('sale-history@test.local');

    const first = await request(app)
      .post('/api/sales')
      .set('Cookie', cookie)
      .send({ items: [{ productId: product.id, quantity: 1 }], notes: 'old sale' });

    const second = await request(app)
      .post('/api/sales')
      .set('Cookie', cookie)
      .send({ items: [{ productId: product.id, quantity: 1 }], notes: 'new sale' });

    await prisma.sale.update({
      where: { id: first.body.data.sale.id },
      data: { soldAt: new Date(2024, 0, 15, 12, 0, 0) },
    });

    const january = await request(app)
      .get('/api/sales?from=2024-01-01&to=2024-01-31')
      .set('Cookie', cookie);

    expect(january.status).toBe(200);
    expect(january.body.data.items).toHaveLength(1);
    expect(january.body.data.items[0].id).toBe(first.body.data.sale.id);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const recent = await request(app)
      .get(`/api/sales?from=${todayStr}`)
      .set('Cookie', cookie);

    expect(recent.status).toBe(200);
    expect(recent.body.data.items.some((sale: { id: string }) => sale.id === second.body.data.sale.id)).toBe(
      true
    );
    expect(recent.body.data.items.some((sale: { id: string }) => sale.id === first.body.data.sale.id)).toBe(
      false
    );
  });

  it('rejects an inverted sales date range', async () => {
    const { cookie } = await setup('sale-range@test.local');

    const response = await request(app)
      .get('/api/sales?from=2024-02-01&to=2024-01-01')
      .set('Cookie', cookie);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_DATE_RANGE');
  });

  it('isolates sales across businesses', async () => {
    const a = await setup('saleA@test.local');
    const b = await setup('saleB@test.local');

    const created = await request(app)
      .post('/api/sales')
      .set('Cookie', a.cookie)
      .send({ items: [{ productId: a.product.id, quantity: 1 }] });

    const forbidden = await request(app)
      .get(`/api/sales/${created.body.data.sale.id}`)
      .set('Cookie', b.cookie);

    expect(forbidden.status).toBe(404);
  });
});
