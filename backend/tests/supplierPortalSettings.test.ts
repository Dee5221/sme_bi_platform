import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ACCOUNT_TYPE_CUSTOMER,
  ACCOUNT_TYPE_SUPPLIER,
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

async function seedSupplierPortalSettingsWorkspace() {
  const { externalCustomerRole, externalSupplierRole } = await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Supplier Portal Settings Co',
      email: 'supplier-portal-settings-co@test.local',
    },
  });

  const customer = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: 'Portal Customer',
      email: 'portal-customer-supplier-settings@test.local',
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: 'Portal Supplier',
      email: 'portal-supplier@test.local',
      phone: '+260922000001',
      address: 'Kitwe',
    },
  });

  await prisma.supplier.create({
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
      email: 'customer-supplier-portal-settings@test.local',
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
      email: 'supplier-supplier-portal-settings@test.local',
      passwordHash,
      firstName: 'Sid',
      lastName: 'Supplier',
      accountType: ACCOUNT_TYPE_SUPPLIER,
      supplierId: supplier.id,
      roles: { create: [{ roleId: externalSupplierRole.id }] },
    },
  });

  const customerLogin = await request(app).post('/api/auth/login').send({
    email: 'customer-supplier-portal-settings@test.local',
    password: 'PortalPass1',
  });

  const supplierLogin = await request(app).post('/api/auth/login').send({
    email: 'supplier-supplier-portal-settings@test.local',
    password: 'PortalPass1',
  });

  return {
    business,
    supplier,
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

describe('Supplier portal settings API', () => {
  it('returns linked supplier contact settings for external suppliers', async () => {
    const { supplierCookie, business, supplier } = await seedSupplierPortalSettingsWorkspace();

    const response = await request(app)
      .get('/api/portal/supplier/settings')
      .set('Cookie', supplierCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.settings.business.name).toBe(business.name);
    expect(response.body.data.settings.supplier.id).toBe(supplier.id);
    expect(response.body.data.settings.supplier.name).toBe('Portal Supplier');
    expect(response.body.data.settings.supplier.email).toBe('portal-supplier@test.local');
    expect(response.body.data.settings.supplier.phone).toBe('+260922000001');
    expect(response.body.data.settings.supplier.status).toBe('ACTIVE');
    expect(response.body.data.settings.supplier.notes).toBeUndefined();
  });

  it('blocks external suppliers from updating linked supplier contact settings', async () => {
    const { supplierCookie } = await seedSupplierPortalSettingsWorkspace();

    const response = await request(app)
      .put('/api/portal/supplier/settings')
      .set('Cookie', supplierCookie)
      .send({
        name: 'Sid Supplier',
        email: 'sid.supplier@test.local',
        phone: '+260922000444',
        address: 'Ndola',
      });

    expect(response.status).toBe(403);
  });

  it('rejects customer accounts from supplier settings APIs', async () => {
    const { customerCookie } = await seedSupplierPortalSettingsWorkspace();

    const getResponse = await request(app)
      .get('/api/portal/supplier/settings')
      .set('Cookie', customerCookie);
    expect(getResponse.status).toBe(403);

    const putResponse = await request(app)
      .put('/api/portal/supplier/settings')
      .set('Cookie', customerCookie)
      .send({
        name: 'Blocked Customer',
        email: 'blocked@test.local',
      });
    expect(putResponse.status).toBe(403);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/portal/supplier/settings');
    expect(response.status).toBe(401);
  });
});
