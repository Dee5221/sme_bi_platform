import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { ensureOwnerManagerRole } from '../src/services/authService';

const app = createApp();

async function resetDb() {
  await prisma.auditLog.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await ensureOwnerManagerRole();
}

async function setupBusiness(email: string) {
  const register = await request(app).post('/api/auth/register').send({
    businessName: 'Inventory Shop',
    firstName: 'Inv',
    lastName: 'Owner',
    email,
    password: 'SecurePass1',
  });
  const cookie = register.headers['set-cookie'] as string[];
  const product = await request(app)
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name: 'Cooking Oil', sku: 'OIL-1', price: 50 });
  return { cookie, product: product.body.data.product };
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

describe('Inventory API', () => {
  it('lists inventory created with products', async () => {
    const { cookie, product } = await setupBusiness('inv1@test.local');
    const response = await request(app).get('/api/inventory').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].productId).toBe(product.id);
    expect(response.body.data.items[0].quantity).toBe(0);
  });

  it('performs stock in and stock out and records movements', async () => {
    const { cookie, product } = await setupBusiness('inv2@test.local');

    const stockIn = await request(app)
      .post('/api/inventory/stock-in')
      .set('Cookie', cookie)
      .send({ productId: product.id, quantity: 20, reason: 'Supplier delivery' });

    expect(stockIn.status).toBe(200);
    expect(stockIn.body.data.inventory.quantity).toBe(20);

    const stockOut = await request(app)
      .post('/api/inventory/stock-out')
      .set('Cookie', cookie)
      .send({ productId: product.id, quantity: 5, reason: 'Damage' });

    expect(stockOut.status).toBe(200);
    expect(stockOut.body.data.inventory.quantity).toBe(15);

    const movements = await request(app)
      .get('/api/inventory/movements')
      .set('Cookie', cookie);

    expect(movements.status).toBe(200);
    expect(movements.body.data.items).toHaveLength(2);
  });

  it('rejects stock out that would make quantity negative', async () => {
    const { cookie, product } = await setupBusiness('inv3@test.local');

    await request(app)
      .post('/api/inventory/stock-in')
      .set('Cookie', cookie)
      .send({ productId: product.id, quantity: 3 });

    const response = await request(app)
      .post('/api/inventory/stock-out')
      .set('Cookie', cookie)
      .send({ productId: product.id, quantity: 10 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('updates low-stock threshold', async () => {
    const { cookie, product } = await setupBusiness('inv4@test.local');
    const list = await request(app).get('/api/inventory').set('Cookie', cookie);
    const inventoryId = list.body.data.items[0].id;

    const updated = await request(app)
      .put(`/api/inventory/${inventoryId}/threshold`)
      .set('Cookie', cookie)
      .send({ lowStockThreshold: 8 });

    expect(updated.status).toBe(200);
    expect(updated.body.data.inventory.lowStockThreshold).toBe(8);
    expect(updated.body.data.inventory.productId).toBe(product.id);
  });

  it('isolates inventory across businesses', async () => {
    const a = await setupBusiness('invA@test.local');
    const b = await setupBusiness('invB@test.local');

    await request(app)
      .post('/api/inventory/stock-in')
      .set('Cookie', a.cookie)
      .send({ productId: a.product.id, quantity: 12 });

    const forbidden = await request(app)
      .post('/api/inventory/stock-in')
      .set('Cookie', b.cookie)
      .send({ productId: a.product.id, quantity: 5 });

    expect(forbidden.status).toBe(404);
  });
});
