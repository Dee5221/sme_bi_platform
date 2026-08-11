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

async function register(email: string, businessName: string) {
  const response = await request(app).post('/api/auth/register').send({
    businessName,
    firstName: 'Owner',
    lastName: 'Test',
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

describe('Products API', () => {
  it('creates category and product with zero inventory', async () => {
    const cookie = await register('prod1@test.local', 'Shop One');

    const categoryRes = await request(app)
      .post('/api/product-categories')
      .set('Cookie', cookie)
      .send({ name: 'Groceries', description: 'Food items' });

    expect(categoryRes.status).toBe(201);

    const productRes = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({
        name: 'Maize Meal 25kg',
        sku: 'mm-25',
        price: 120.5,
        unit: 'bag',
        categoryId: categoryRes.body.data.category.id,
      });

    expect(productRes.status).toBe(201);
    expect(productRes.body.data.product.sku).toBe('MM-25');
    expect(productRes.body.data.product.price).toBe(120.5);
    expect(productRes.body.data.product.inventory.quantity).toBe(0);
  });

  it('lists and searches products for the authenticated business only', async () => {
    const cookieA = await register('prodA@test.local', 'Shop A');
    const cookieB = await register('prodB@test.local', 'Shop B');

    await request(app)
      .post('/api/products')
      .set('Cookie', cookieA)
      .send({ name: 'Sugar 2kg', sku: 'SUG-2', price: 40 });

    await request(app)
      .post('/api/products')
      .set('Cookie', cookieB)
      .send({ name: 'Sugar 2kg', sku: 'SUG-2', price: 45 });

    const listA = await request(app)
      .get('/api/products?search=Sugar')
      .set('Cookie', cookieA);

    expect(listA.status).toBe(200);
    expect(listA.body.data.items).toHaveLength(1);
    expect(listA.body.data.items[0].price).toBe(40);
  });

  it('rejects duplicate SKU in the same business', async () => {
    const cookie = await register('prod2@test.local', 'Shop Two');

    await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Rice', sku: 'RICE-1', price: 80 });

    const duplicate = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Rice Large', sku: 'rice-1', price: 85 });

    expect(duplicate.status).toBe(409);
  });

  it('prevents cross-business product access', async () => {
    const cookieA = await register('prodX@test.local', 'Shop X');
    const cookieB = await register('prodY@test.local', 'Shop Y');

    const created = await request(app)
      .post('/api/products')
      .set('Cookie', cookieA)
      .send({ name: 'Oil 2L', sku: 'OIL-2', price: 70 });

    const forbidden = await request(app)
      .get(`/api/products/${created.body.data.product.id}`)
      .set('Cookie', cookieB);

    expect(forbidden.status).toBe(404);
  });

  it('deactivates a product instead of hard deleting', async () => {
    const cookie = await register('prod3@test.local', 'Shop Three');
    const created = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Soap', sku: 'SOAP-1', price: 15 });

    const deactivated = await request(app)
      .delete(`/api/products/${created.body.data.product.id}`)
      .set('Cookie', cookie);

    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.product.status).toBe('INACTIVE');

    const activeList = await request(app).get('/api/products').set('Cookie', cookie);
    expect(activeList.body.data.items).toHaveLength(0);

    const allList = await request(app)
      .get('/api/products?status=ALL')
      .set('Cookie', cookie);
    expect(allList.body.data.items).toHaveLength(1);
  });

  it('rejects unauthenticated product list', async () => {
    const response = await request(app).get('/api/products');
    expect(response.status).toBe(401);
  });
});
