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

describe('Suppliers API', () => {
  it('creates and lists suppliers for the authenticated business', async () => {
    const cookie = await register('sup1@test.local', 'Supplier Shop');

    const created = await request(app)
      .post('/api/suppliers')
      .set('Cookie', cookie)
      .send({
        name: 'Fresh Farms Ltd',
        email: 'orders@freshfarms.test',
        phone: '+260900000010',
      });

    expect(created.status).toBe(201);
    expect(created.body.data.supplier.name).toBe('Fresh Farms Ltd');

    const list = await request(app).get('/api/suppliers').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
  });

  it('rejects duplicate supplier email within the same business', async () => {
    const cookie = await register('sup2@test.local', 'Supplier Shop 2');

    await request(app)
      .post('/api/suppliers')
      .set('Cookie', cookie)
      .send({ name: 'One', email: 'same@supplier.test' });

    const duplicate = await request(app)
      .post('/api/suppliers')
      .set('Cookie', cookie)
      .send({ name: 'Two', email: 'same@supplier.test' });

    expect(duplicate.status).toBe(409);
  });

  it('prevents cross-business supplier access', async () => {
    const cookieA = await register('supA@test.local', 'Shop A');
    const cookieB = await register('supB@test.local', 'Shop B');

    const created = await request(app)
      .post('/api/suppliers')
      .set('Cookie', cookieA)
      .send({ name: 'Only A' });

    const forbidden = await request(app)
      .get(`/api/suppliers/${created.body.data.supplier.id}`)
      .set('Cookie', cookieB);

    expect(forbidden.status).toBe(404);
  });

  it('deactivates a supplier', async () => {
    const cookie = await register('sup3@test.local', 'Shop C');
    const created = await request(app)
      .post('/api/suppliers')
      .set('Cookie', cookie)
      .send({ name: 'Temp Supplier' });

    const deactivated = await request(app)
      .delete(`/api/suppliers/${created.body.data.supplier.id}`)
      .set('Cookie', cookie);

    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.supplier.status).toBe('INACTIVE');
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/suppliers');
    expect(response.status).toBe(401);
  });
});
