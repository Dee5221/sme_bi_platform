import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ROLE_STAFF,
  STAFF_PERMISSIONS,
} from '../src/constants/permissions';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { ensureSystemRoles } from '../src/services/authService';

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
  await ensureSystemRoles();
}

async function seedStaff() {
  const { staffRole } = await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Staff Test Biz',
      email: 'staff-biz@test.local',
    },
  });
  const passwordHash = await hashPassword('StaffPass1');
  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'staff@test.local',
      passwordHash,
      firstName: 'Riley',
      lastName: 'Staff',
      roles: {
        create: [{ roleId: staffRole.id }],
      },
    },
  });
  return { business, email: 'staff@test.local', password: 'StaffPass1' };
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key-123456';
  process.env.NODE_ENV = 'test';
  process.env.CLIENT_ORIGIN = 'http://localhost:5173';
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Staff role foundation', () => {
  it('creates STAFF with operational permissions only', async () => {
    const staffRole = await prisma.role.findUniqueOrThrow({
      where: { name: ROLE_STAFF },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    const staffKeys = staffRole.permissions.map((item) => item.permission.key).sort();
    expect(staffKeys).toEqual(STAFF_PERMISSIONS.map((item) => item.key).sort());
    expect(staffKeys).toContain('sales.view');
    expect(staffKeys).toContain('inventory.adjust');
    expect(staffKeys).not.toContain('users.view');
    expect(staffKeys).not.toContain('analytics.view');
    expect(staffKeys).not.toContain('expenses.view');
    expect(staffKeys).not.toContain('products.delete');
  });

  it('logs in staff with operational permissions only', async () => {
    const { email, password } = await seedStaff();

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.data.user.roles).toContain(ROLE_STAFF);
    expect(login.body.data.user.permissions).toContain('sales.create');
    expect(login.body.data.user.permissions).toContain('customers.view');
    expect(login.body.data.user.permissions).not.toContain('users.view');
    expect(login.body.data.user.permissions).not.toContain('reports.view');
  });

  it('allows staff to access sales and dashboard but not admin or expense APIs', async () => {
    const { email, password } = await seedStaff();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const dashboard = await request(app).get('/api/staff/dashboard').set('Cookie', cookie);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.dashboard.kpis.expenses).toBeUndefined();

    const ownerDashboard = await request(app).get('/api/dashboard').set('Cookie', cookie);
    expect(ownerDashboard.status).toBe(403);

    const products = await request(app).get('/api/products').set('Cookie', cookie);
    expect(products.status).toBe(200);

    const inventory = await request(app).get('/api/inventory').set('Cookie', cookie);
    expect(inventory.status).toBe(200);

    const movements = await request(app).get('/api/inventory/movements').set('Cookie', cookie);
    expect(movements.status).toBe(200);

    const customers = await request(app).get('/api/customers').set('Cookie', cookie);
    expect(customers.status).toBe(200);

    const suppliers = await request(app).get('/api/suppliers').set('Cookie', cookie);
    expect(suppliers.status).toBe(200);

    const sales = await request(app).get('/api/sales').set('Cookie', cookie);
    expect(sales.status).toBe(200);

    const users = await request(app).get('/api/users').set('Cookie', cookie);
    expect(users.status).toBe(403);

    const expenses = await request(app).get('/api/expenses').set('Cookie', cookie);
    expect(expenses.status).toBe(403);

    const profile = await request(app).get('/api/profile').set('Cookie', cookie);
    expect(profile.status).toBe(200);
  });

  it('lets staff record and list a sale for their business', async () => {
    const { email, password } = await seedStaff();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const product = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Bread', sku: 'BRD-STAFF', price: 10 });
    expect(product.status).toBe(201);

    await request(app)
      .post('/api/inventory/stock-in')
      .set('Cookie', cookie)
      .send({ productId: product.body.data.product.id, quantity: 20 });

    const created = await request(app)
      .post('/api/sales')
      .set('Cookie', cookie)
      .send({ items: [{ productId: product.body.data.product.id, quantity: 2 }] });

    expect(created.status).toBe(201);
    expect(created.body.data.sale.total).toBe(20);

    const list = await request(app).get('/api/sales').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].id).toBe(created.body.data.sale.id);
  });

  it('lets staff manage the catalog but not deactivate products', async () => {
    const { email, password } = await seedStaff();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const created = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Soap', sku: 'SOAP-STAFF', price: 12.5 });
    expect(created.status).toBe(201);
    const productId = created.body.data.product.id;

    const updated = await request(app)
      .put(`/api/products/${productId}`)
      .set('Cookie', cookie)
      .send({ name: 'Bar soap', sku: 'SOAP-STAFF', price: 13 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.product.name).toBe('Bar soap');
    expect(updated.body.data.product.status).toBe('ACTIVE');

    const deactivateViaUpdate = await request(app)
      .put(`/api/products/${productId}`)
      .set('Cookie', cookie)
      .send({ name: 'Bar soap', sku: 'SOAP-STAFF', price: 13, status: 'INACTIVE' });
    expect(deactivateViaUpdate.status).toBe(403);

    const deactivate = await request(app)
      .delete(`/api/products/${productId}`)
      .set('Cookie', cookie);
    expect(deactivate.status).toBe(403);

    const stillActive = await request(app)
      .get(`/api/products/${productId}`)
      .set('Cookie', cookie);
    expect(stillActive.status).toBe(200);
    expect(stillActive.body.data.product.status).toBe('ACTIVE');
  });

  it('lets staff manage customers but not deactivate them', async () => {
    const { email, password } = await seedStaff();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const created = await request(app)
      .post('/api/customers')
      .set('Cookie', cookie)
      .send({ name: 'Walk-in Regular', email: 'regular@test.local', phone: '555-0100' });
    expect(created.status).toBe(201);
    const customerId = created.body.data.customer.id;

    const updated = await request(app)
      .put(`/api/customers/${customerId}`)
      .set('Cookie', cookie)
      .send({ name: 'Regular Customer', email: 'regular@test.local', phone: '555-0101' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.customer.name).toBe('Regular Customer');
    expect(updated.body.data.customer.status).toBe('ACTIVE');

    const deactivateViaUpdate = await request(app)
      .put(`/api/customers/${customerId}`)
      .set('Cookie', cookie)
      .send({
        name: 'Regular Customer',
        email: 'regular@test.local',
        status: 'INACTIVE',
      });
    expect(deactivateViaUpdate.status).toBe(403);

    const deactivate = await request(app)
      .delete(`/api/customers/${customerId}`)
      .set('Cookie', cookie);
    expect(deactivate.status).toBe(403);

    const stillActive = await request(app)
      .get(`/api/customers/${customerId}`)
      .set('Cookie', cookie);
    expect(stillActive.status).toBe(200);
    expect(stillActive.body.data.customer.status).toBe('ACTIVE');
  });

  it('lets staff manage suppliers but not deactivate them', async () => {
    const { email, password } = await seedStaff();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const created = await request(app)
      .post('/api/suppliers')
      .set('Cookie', cookie)
      .send({ name: 'Fresh Foods Ltd', email: 'orders@freshfoods.test', phone: '555-0200' });
    expect(created.status).toBe(201);
    const supplierId = created.body.data.supplier.id;

    const updated = await request(app)
      .put(`/api/suppliers/${supplierId}`)
      .set('Cookie', cookie)
      .send({
        name: 'Fresh Foods Wholesale',
        email: 'orders@freshfoods.test',
        phone: '555-0201',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.supplier.name).toBe('Fresh Foods Wholesale');
    expect(updated.body.data.supplier.status).toBe('ACTIVE');

    const deactivateViaUpdate = await request(app)
      .put(`/api/suppliers/${supplierId}`)
      .set('Cookie', cookie)
      .send({
        name: 'Fresh Foods Wholesale',
        email: 'orders@freshfoods.test',
        status: 'INACTIVE',
      });
    expect(deactivateViaUpdate.status).toBe(403);

    const deactivate = await request(app)
      .delete(`/api/suppliers/${supplierId}`)
      .set('Cookie', cookie);
    expect(deactivate.status).toBe(403);

    const stillActive = await request(app)
      .get(`/api/suppliers/${supplierId}`)
      .set('Cookie', cookie);
    expect(stillActive.status).toBe(200);
    expect(stillActive.body.data.supplier.status).toBe('ACTIVE');
  });

  it('lets staff view and update their own profile', async () => {
    const { email, password } = await seedStaff();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const profile = await request(app).get('/api/profile').set('Cookie', cookie);
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.email).toBe('staff@test.local');
    expect(profile.body.data.user.roles).toContain('STAFF');

    const updated = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({
        firstName: 'Riley',
        lastName: 'Staffer',
        email: 'staff@test.local',
        phone: '+260911000222',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.user.lastName).toBe('Staffer');
    expect(updated.body.data.user.phone).toBe('+260911000222');
  });
});
