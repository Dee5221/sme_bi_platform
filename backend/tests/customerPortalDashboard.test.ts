import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ACCOUNT_TYPE_CUSTOMER,
  ACCOUNT_TYPE_SUPPLIER,
  ROLE_EXTERNAL_CUSTOMER,
  ROLE_EXTERNAL_SUPPLIER,
  ROLE_OWNER_MANAGER,
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

async function seedCustomerPortalWorkspace() {
  const { ownerRole, externalCustomerRole, externalSupplierRole } =
    await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Portal Customer Co',
      email: 'portal-customer-co@test.local',
    },
  });

  const customer = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: 'Portal Customer',
      email: 'portal-customer@test.local',
    },
  });

  const otherCustomer = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: 'Other Customer',
      email: 'other-customer@test.local',
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: 'Portal Supplier',
      email: 'portal-supplier@test.local',
    },
  });

  const passwordHash = await hashPassword('PortalPass1');

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'owner-portal@test.local',
      passwordHash,
      firstName: 'Olivia',
      lastName: 'Owner',
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'customer-portal@test.local',
      passwordHash,
      firstName: 'Casey',
      lastName: 'Customer',
      accountType: ACCOUNT_TYPE_CUSTOMER,
      customerId: customer.id,
      roles: { create: [{ roleId: externalCustomerRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'supplier-portal@test.local',
      passwordHash,
      firstName: 'Sid',
      lastName: 'Supplier',
      accountType: ACCOUNT_TYPE_SUPPLIER,
      supplierId: supplier.id,
      roles: { create: [{ roleId: externalSupplierRole.id }] },
    },
  });

  const ownerLogin = await request(app).post('/api/auth/login').send({
    email: 'owner-portal@test.local',
    password: 'PortalPass1',
  });
  const ownerCookie = ownerLogin.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', ownerCookie)
    .send({ name: 'Notebook', sku: 'NB-PORTAL', price: 15 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', ownerCookie)
    .send({ productId: product.body.data.product.id, quantity: 20 });

  await request(app)
    .post('/api/sales')
    .set('Cookie', ownerCookie)
    .send({
      customerId: customer.id,
      items: [{ productId: product.body.data.product.id, quantity: 2 }],
    });

  await request(app)
    .post('/api/sales')
    .set('Cookie', ownerCookie)
    .send({
      customerId: otherCustomer.id,
      items: [{ productId: product.body.data.product.id, quantity: 5 }],
    });

  const customerLogin = await request(app).post('/api/auth/login').send({
    email: 'customer-portal@test.local',
    password: 'PortalPass1',
  });

  const supplierLogin = await request(app).post('/api/auth/login').send({
    email: 'supplier-portal@test.local',
    password: 'PortalPass1',
  });

  return {
    business,
    customer,
    customerCookie: customerLogin.headers['set-cookie'] as string[],
    supplierCookie: supplierLogin.headers['set-cookie'] as string[],
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

describe('Customer portal dashboard API', () => {
  it('returns purchase KPIs scoped to the linked customer', async () => {
    const { customerCookie, business, customer } = await seedCustomerPortalWorkspace();

    const response = await request(app)
      .get('/api/portal/customer/dashboard')
      .set('Cookie', customerCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.dashboard.business.name).toBe(business.name);
    expect(response.body.data.dashboard.customer.id).toBe(customer.id);
    expect(response.body.data.dashboard.customer.name).toBe('Portal Customer');
    expect(response.body.data.dashboard.kpis.lifetimePurchaseCount).toBe(1);
    expect(response.body.data.dashboard.kpis.lifetimeSpent).toBe(30);
    expect(response.body.data.dashboard.kpis.monthPurchaseCount).toBe(1);
    expect(response.body.data.dashboard.kpis.monthSpent).toBe(30);
    expect(response.body.data.dashboard.kpis.averageOrderValue).toBe(30);
    expect(response.body.data.dashboard.recentPurchases).toHaveLength(1);
    expect(response.body.data.dashboard.recentPurchases[0].total).toBe(30);
    expect(response.body.data.dashboard.recentPurchases[0].itemCount).toBe(1);
  });

  it('rejects supplier accounts from the customer dashboard', async () => {
    const { supplierCookie } = await seedCustomerPortalWorkspace();

    const response = await request(app)
      .get('/api/portal/customer/dashboard')
      .set('Cookie', supplierCookie);

    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/portal/customer/dashboard');
    expect(response.status).toBe(401);
  });

  it('returns empty purchase metrics when the customer has no sales yet', async () => {
    const { externalCustomerRole } = await ensureSystemRoles();
    const business = await prisma.business.create({
      data: { name: 'Empty Portal Co', email: 'empty-portal@test.local' },
    });
    const customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'New Customer',
        email: 'new-customer@test.local',
      },
    });
    const passwordHash = await hashPassword('PortalPass1');
    await prisma.user.create({
      data: {
        businessId: business.id,
        email: 'empty-customer@test.local',
        passwordHash,
        firstName: 'New',
        lastName: 'Customer',
        accountType: ACCOUNT_TYPE_CUSTOMER,
        customerId: customer.id,
        roles: { create: [{ roleId: externalCustomerRole.id }] },
      },
    });

    const login = await request(app).post('/api/auth/login').send({
      email: 'empty-customer@test.local',
      password: 'PortalPass1',
    });

    const response = await request(app)
      .get('/api/portal/customer/dashboard')
      .set('Cookie', login.headers['set-cookie']);

    expect(response.status).toBe(200);
    expect(response.body.data.dashboard.kpis.lifetimePurchaseCount).toBe(0);
    expect(response.body.data.dashboard.kpis.lifetimeSpent).toBe(0);
    expect(response.body.data.dashboard.recentPurchases).toHaveLength(0);
  });
});
