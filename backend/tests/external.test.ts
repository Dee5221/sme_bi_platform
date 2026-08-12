import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ACCOUNT_TYPE_CUSTOMER,
  ACCOUNT_TYPE_SUPPLIER,
  EXTERNAL_CUSTOMER_PERMISSIONS,
  EXTERNAL_SUPPLIER_PERMISSIONS,
  ROLE_EXTERNAL_CUSTOMER,
  ROLE_EXTERNAL_SUPPLIER,
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
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.business.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await ensureSystemRoles();
}

async function seedExternalCustomer() {
  const { externalCustomerRole } = await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'External Customer Test Biz',
      email: 'external-customer-biz@test.local',
    },
  });
  const customer = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: 'Portal Customer',
      email: 'portal-customer@test.local',
    },
  });
  const passwordHash = await hashPassword('CustomerPass1');
  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'customer@test.local',
      passwordHash,
      firstName: 'Casey',
      lastName: 'Customer',
      accountType: ACCOUNT_TYPE_CUSTOMER,
      customerId: customer.id,
      roles: {
        create: [{ roleId: externalCustomerRole.id }],
      },
    },
  });
  return {
    business,
    customer,
    email: 'customer@test.local',
    password: 'CustomerPass1',
  };
}

async function seedExternalSupplier() {
  const { externalSupplierRole } = await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'External Supplier Test Biz',
      email: 'external-supplier-biz@test.local',
    },
  });
  const supplier = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: 'Portal Supplier',
      email: 'portal-supplier@test.local',
    },
  });
  const passwordHash = await hashPassword('SupplierPass1');
  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'supplier@test.local',
      passwordHash,
      firstName: 'Sid',
      lastName: 'Supplier',
      accountType: ACCOUNT_TYPE_SUPPLIER,
      supplierId: supplier.id,
      roles: {
        create: [{ roleId: externalSupplierRole.id }],
      },
    },
  });
  return {
    business,
    supplier,
    email: 'supplier@test.local',
    password: 'SupplierPass1',
  };
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

describe('External user role foundation', () => {
  it('creates EXTERNAL_CUSTOMER with portal purchase permissions only', async () => {
    const customerRole = await prisma.role.findUniqueOrThrow({
      where: { name: ROLE_EXTERNAL_CUSTOMER },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    const customerKeys = customerRole.permissions
      .map((item) => item.permission.key)
      .sort();
    expect(customerKeys).toEqual(
      EXTERNAL_CUSTOMER_PERMISSIONS.map((item) => item.key).sort()
    );
    expect(customerKeys).toContain('portal.purchases.view');
    expect(customerKeys).not.toContain('portal.products.view');
    expect(customerKeys).not.toContain('sales.view');
    expect(customerKeys).not.toContain('products.view');
  });

  it('creates EXTERNAL_SUPPLIER with portal supply permissions only', async () => {
    const supplierRole = await prisma.role.findUniqueOrThrow({
      where: { name: ROLE_EXTERNAL_SUPPLIER },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    const supplierKeys = supplierRole.permissions
      .map((item) => item.permission.key)
      .sort();
    expect(supplierKeys).toEqual(
      EXTERNAL_SUPPLIER_PERMISSIONS.map((item) => item.key).sort()
    );
    expect(supplierKeys).toContain('portal.products.view');
    expect(supplierKeys).not.toContain('portal.purchases.view');
    expect(supplierKeys).not.toContain('sales.view');
    expect(supplierKeys).not.toContain('suppliers.view');
  });

  it('logs in external customer with linked customer record and portal permissions', async () => {
    const { customer, email, password } = await seedExternalCustomer();

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.data.user.roles).toContain(ROLE_EXTERNAL_CUSTOMER);
    expect(login.body.data.user.accountType).toBe(ACCOUNT_TYPE_CUSTOMER);
    expect(login.body.data.user.customerId).toBe(customer.id);
    expect(login.body.data.user.supplierId).toBeNull();
    expect(login.body.data.user.permissions).toContain('portal.purchases.view');
    expect(login.body.data.user.permissions).not.toContain('portal.products.view');
    expect(login.body.data.user.permissions).not.toContain('sales.view');
  });

  it('logs in external supplier with linked supplier record and portal permissions', async () => {
    const { supplier, email, password } = await seedExternalSupplier();

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.data.user.roles).toContain(ROLE_EXTERNAL_SUPPLIER);
    expect(login.body.data.user.accountType).toBe(ACCOUNT_TYPE_SUPPLIER);
    expect(login.body.data.user.supplierId).toBe(supplier.id);
    expect(login.body.data.user.customerId).toBeNull();
    expect(login.body.data.user.permissions).toContain('portal.products.view');
    expect(login.body.data.user.permissions).not.toContain('portal.purchases.view');
    expect(login.body.data.user.permissions).not.toContain('suppliers.view');
  });

  it('blocks external customer from internal operational APIs', async () => {
    const { email, password } = await seedExternalCustomer();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const profile = await request(app).get('/api/profile').set('Cookie', cookie);
    expect(profile.status).toBe(200);

    const products = await request(app).get('/api/products').set('Cookie', cookie);
    expect(products.status).toBe(403);

    const sales = await request(app).get('/api/sales').set('Cookie', cookie);
    expect(sales.status).toBe(403);

    const staffDashboard = await request(app).get('/api/staff/dashboard').set('Cookie', cookie);
    expect(staffDashboard.status).toBe(403);

    const ownerDashboard = await request(app).get('/api/dashboard').set('Cookie', cookie);
    expect(ownerDashboard.status).toBe(403);

    const users = await request(app).get('/api/users').set('Cookie', cookie);
    expect(users.status).toBe(403);
  });

  it('blocks external supplier from internal operational APIs', async () => {
    const { email, password } = await seedExternalSupplier();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const profile = await request(app).get('/api/profile').set('Cookie', cookie);
    expect(profile.status).toBe(200);

    const products = await request(app).get('/api/products').set('Cookie', cookie);
    expect(products.status).toBe(403);

    const inventory = await request(app).get('/api/inventory').set('Cookie', cookie);
    expect(inventory.status).toBe(403);

    const suppliers = await request(app).get('/api/suppliers').set('Cookie', cookie);
    expect(suppliers.status).toBe(403);

    const adminDashboard = await request(app).get('/api/admin/dashboard').set('Cookie', cookie);
    expect(adminDashboard.status).toBe(403);
  });

  it('lets external customer view and update their own profile', async () => {
    const { customer, email, password } = await seedExternalCustomer();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const profile = await request(app).get('/api/profile').set('Cookie', cookie);
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.email).toBe('customer@test.local');
    expect(profile.body.data.user.roles).toContain(ROLE_EXTERNAL_CUSTOMER);
    expect(profile.body.data.user.accountType).toBe(ACCOUNT_TYPE_CUSTOMER);
    expect(profile.body.data.user.customerId).toBe(customer.id);

    const updated = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({
        firstName: 'Casey',
        lastName: 'Buyer',
        email: 'customer@test.local',
        phone: '+260911000333',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.user.lastName).toBe('Buyer');
    expect(updated.body.data.user.phone).toBe('+260911000333');
  });

  it('lets external supplier view and update their own profile', async () => {
    const { supplier, email, password } = await seedExternalSupplier();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const profile = await request(app).get('/api/profile').set('Cookie', cookie);
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.email).toBe('supplier@test.local');
    expect(profile.body.data.user.roles).toContain(ROLE_EXTERNAL_SUPPLIER);
    expect(profile.body.data.user.accountType).toBe(ACCOUNT_TYPE_SUPPLIER);
    expect(profile.body.data.user.supplierId).toBe(supplier.id);

    const updated = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({
        firstName: 'Sid',
        lastName: 'Vendor',
        email: 'supplier@test.local',
        phone: '+260911000444',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.user.lastName).toBe('Vendor');
    expect(updated.body.data.user.phone).toBe('+260911000444');
  });
});
