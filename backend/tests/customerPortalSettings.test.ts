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

async function seedPortalSettingsWorkspace() {
  const { externalCustomerRole, externalSupplierRole } = await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Portal Settings Co',
      email: 'portal-settings-co@test.local',
    },
  });

  const customer = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: 'Portal Customer',
      email: 'portal-customer@test.local',
      phone: '+260911000001',
      address: 'Lusaka',
    },
  });

  await prisma.customer.create({
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
      email: 'customer-portal-settings@test.local',
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
      email: 'supplier-portal-settings@test.local',
      passwordHash,
      firstName: 'Sid',
      lastName: 'Supplier',
      accountType: ACCOUNT_TYPE_SUPPLIER,
      supplierId: supplier.id,
      roles: { create: [{ roleId: externalSupplierRole.id }] },
    },
  });

  const customerLogin = await request(app).post('/api/auth/login').send({
    email: 'customer-portal-settings@test.local',
    password: 'PortalPass1',
  });

  const supplierLogin = await request(app).post('/api/auth/login').send({
    email: 'supplier-portal-settings@test.local',
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

describe('Customer portal settings API', () => {
  it('returns linked customer contact settings for external customers', async () => {
    const { customerCookie, business, customer } = await seedPortalSettingsWorkspace();

    const response = await request(app)
      .get('/api/portal/customer/settings')
      .set('Cookie', customerCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.settings.business.name).toBe(business.name);
    expect(response.body.data.settings.customer.id).toBe(customer.id);
    expect(response.body.data.settings.customer.name).toBe('Portal Customer');
    expect(response.body.data.settings.customer.email).toBe('portal-customer@test.local');
    expect(response.body.data.settings.customer.phone).toBe('+260911000001');
    expect(response.body.data.settings.customer.status).toBe('ACTIVE');
    expect(response.body.data.settings.customer.preferredCurrency).toBe('USD');
    expect(response.body.data.settings.business.usdToZmwRate).toBe(18.5);
    expect(response.body.data.settings.customer.notes).toBeUndefined();
  });

  it('allows external customers to update preferred pricing currency', async () => {
    const { customerCookie, customer } = await seedPortalSettingsWorkspace();

    const response = await request(app)
      .put('/api/portal/customer/currency')
      .set('Cookie', customerCookie)
      .send({ preferredCurrency: 'ZMW' });

    expect(response.status).toBe(200);
    expect(response.body.data.settings.customer.preferredCurrency).toBe('ZMW');

    const stored = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(stored?.preferredCurrency).toBe('ZMW');
  });

  it('blocks external customers from updating linked customer contact settings', async () => {
    const { customerCookie } = await seedPortalSettingsWorkspace();

    const response = await request(app)
      .put('/api/portal/customer/settings')
      .set('Cookie', customerCookie)
      .send({
        name: 'Casey Customer',
        email: 'casey.customer@test.local',
        phone: '+260911000444',
        address: 'Ndola',
      });

    expect(response.status).toBe(403);
  });

  it('rejects supplier accounts from customer settings APIs', async () => {
    const { supplierCookie } = await seedPortalSettingsWorkspace();

    const getResponse = await request(app)
      .get('/api/portal/customer/settings')
      .set('Cookie', supplierCookie);
    expect(getResponse.status).toBe(403);

    const putResponse = await request(app)
      .put('/api/portal/customer/settings')
      .set('Cookie', supplierCookie)
      .send({
        name: 'Blocked Supplier',
        email: 'blocked@test.local',
      });
    expect(putResponse.status).toBe(403);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/portal/customer/settings');
    expect(response.status).toBe(401);
  });
});
