import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ACCOUNT_TYPE_CUSTOMER,
  ACCOUNT_TYPE_SUPPLIER,
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

async function seedSupplierDashboardWorkspace() {
  const { ownerRole, externalCustomerRole, externalSupplierRole } =
    await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Portal Supplier Co',
      email: 'portal-supplier-co@test.local',
    },
  });

  const customer = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: 'Portal Customer',
      email: 'portal-customer@test.local',
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: 'Portal Supplier',
      email: 'portal-supplier@test.local',
    },
  });

  const otherSupplier = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: 'Other Supplier',
      email: 'other-supplier@test.local',
    },
  });

  const passwordHash = await hashPassword('PortalPass1');

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'owner-portal-supplier@test.local',
      passwordHash,
      firstName: 'Olivia',
      lastName: 'Owner',
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'customer-portal-supplier@test.local',
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
      email: 'supplier-portal-supplier@test.local',
      passwordHash,
      firstName: 'Sid',
      lastName: 'Supplier',
      accountType: ACCOUNT_TYPE_SUPPLIER,
      supplierId: supplier.id,
      roles: { create: [{ roleId: externalSupplierRole.id }] },
    },
  });

  const ownerLogin = await request(app).post('/api/auth/login').send({
    email: 'owner-portal-supplier@test.local',
    password: 'PortalPass1',
  });
  const ownerCookie = ownerLogin.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', ownerCookie)
    .send({ name: 'Rice Bag', sku: 'RICE-SUP', price: 20 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', ownerCookie)
    .send({
      productId: product.body.data.product.id,
      quantity: 50,
      supplierId: supplier.id,
      reason: 'Initial supplier delivery',
    });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', ownerCookie)
    .send({
      productId: product.body.data.product.id,
      quantity: 10,
      supplierId: otherSupplier.id,
      reason: 'Other supplier delivery',
    });

  const supplierLogin = await request(app).post('/api/auth/login').send({
    email: 'supplier-portal-supplier@test.local',
    password: 'PortalPass1',
  });

  const customerLogin = await request(app).post('/api/auth/login').send({
    email: 'customer-portal-supplier@test.local',
    password: 'PortalPass1',
  });

  return {
    business,
    supplier,
    supplierCookie: supplierLogin.headers['set-cookie'] as string[],
    customerCookie: customerLogin.headers['set-cookie'] as string[],
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

describe('Supplier portal dashboard API', () => {
  it('returns supply KPIs scoped to the linked supplier', async () => {
    const { supplierCookie, business, supplier } = await seedSupplierDashboardWorkspace();

    const response = await request(app)
      .get('/api/portal/supplier/dashboard')
      .set('Cookie', supplierCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.dashboard.business.name).toBe(business.name);
    expect(response.body.data.dashboard.supplier.id).toBe(supplier.id);
    expect(response.body.data.dashboard.kpis.lifetimeSupplyRecords).toBe(1);
    expect(response.body.data.dashboard.kpis.lifetimeUnitsSupplied).toBe(50);
    expect(response.body.data.dashboard.kpis.monthSupplyRecords).toBe(1);
    expect(response.body.data.dashboard.kpis.monthUnitsSupplied).toBe(50);
    expect(response.body.data.dashboard.kpis.productsSupplied).toBe(1);
    expect(response.body.data.dashboard.kpis.averageUnitsPerRecord).toBe(50);
    expect(response.body.data.dashboard.recentSupplyRecords).toHaveLength(1);
    expect(response.body.data.dashboard.recentSupplyRecords[0].productName).toBe('Rice Bag');
    expect(response.body.data.dashboard.recentSupplyRecords[0].quantity).toBe(50);
  });

  it('rejects customer accounts from the supplier dashboard', async () => {
    const { customerCookie } = await seedSupplierDashboardWorkspace();

    const response = await request(app)
      .get('/api/portal/supplier/dashboard')
      .set('Cookie', customerCookie);

    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/portal/supplier/dashboard');
    expect(response.status).toBe(401);
  });

  it('returns empty supply metrics when the supplier has no stock-in records yet', async () => {
    const { externalSupplierRole } = await ensureSystemRoles();
    const business = await prisma.business.create({
      data: { name: 'Empty Supplier Co', email: 'empty-supplier-co@test.local' },
    });
    const supplier = await prisma.supplier.create({
      data: {
        businessId: business.id,
        name: 'New Supplier',
        email: 'new-supplier@test.local',
      },
    });
    const passwordHash = await hashPassword('PortalPass1');
    await prisma.user.create({
      data: {
        businessId: business.id,
        email: 'empty-supplier@test.local',
        passwordHash,
        firstName: 'New',
        lastName: 'Supplier',
        accountType: ACCOUNT_TYPE_SUPPLIER,
        supplierId: supplier.id,
        roles: { create: [{ roleId: externalSupplierRole.id }] },
      },
    });

    const login = await request(app).post('/api/auth/login').send({
      email: 'empty-supplier@test.local',
      password: 'PortalPass1',
    });

    const response = await request(app)
      .get('/api/portal/supplier/dashboard')
      .set('Cookie', login.headers['set-cookie']);

    expect(response.status).toBe(200);
    expect(response.body.data.dashboard.kpis.lifetimeSupplyRecords).toBe(0);
    expect(response.body.data.dashboard.kpis.productsSupplied).toBe(0);
    expect(response.body.data.dashboard.recentSupplyRecords).toHaveLength(0);
  });
});
