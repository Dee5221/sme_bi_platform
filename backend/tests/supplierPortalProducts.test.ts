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

async function seedSuppliedProductsWorkspace() {
  const { ownerRole, externalCustomerRole, externalSupplierRole } =
    await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Supplied Products Co',
      email: 'supplied-products-co@test.local',
    },
  });

  await prisma.customer.create({
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
      email: 'owner-supplied-products@test.local',
      passwordHash,
      firstName: 'Olivia',
      lastName: 'Owner',
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'customer-supplied-products@test.local',
      passwordHash,
      firstName: 'Casey',
      lastName: 'Customer',
      accountType: ACCOUNT_TYPE_CUSTOMER,
      customerId: (await prisma.customer.findFirstOrThrow()).id,
      roles: { create: [{ roleId: externalCustomerRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'supplier-supplied-products@test.local',
      passwordHash,
      firstName: 'Sid',
      lastName: 'Supplier',
      accountType: ACCOUNT_TYPE_SUPPLIER,
      supplierId: supplier.id,
      roles: { create: [{ roleId: externalSupplierRole.id }] },
    },
  });

  const ownerLogin = await request(app).post('/api/auth/login').send({
    email: 'owner-supplied-products@test.local',
    password: 'PortalPass1',
  });
  const ownerCookie = ownerLogin.headers['set-cookie'] as string[];

  const rice = await request(app)
    .post('/api/products')
    .set('Cookie', ownerCookie)
    .send({ name: 'Rice Bag', sku: 'RICE-SUP', price: 20 });

  const soap = await request(app)
    .post('/api/products')
    .set('Cookie', ownerCookie)
    .send({ name: 'Bar Soap', sku: 'SOAP-SUP', price: 5 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', ownerCookie)
    .send({
      productId: rice.body.data.product.id,
      quantity: 50,
      supplierId: supplier.id,
      reason: 'Rice delivery',
    });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', ownerCookie)
    .send({
      productId: rice.body.data.product.id,
      quantity: 20,
      supplierId: supplier.id,
      reason: 'Rice top-up',
    });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', ownerCookie)
    .send({
      productId: soap.body.data.product.id,
      quantity: 10,
      supplierId: otherSupplier.id,
      reason: 'Other supplier soap',
    });

  const supplierLogin = await request(app).post('/api/auth/login').send({
    email: 'supplier-supplied-products@test.local',
    password: 'PortalPass1',
  });

  const customerLogin = await request(app).post('/api/auth/login').send({
    email: 'customer-supplied-products@test.local',
    password: 'PortalPass1',
  });

  return {
    supplierCookie: supplierLogin.headers['set-cookie'] as string[],
    customerCookie: customerLogin.headers['set-cookie'] as string[],
    riceProductId: rice.body.data.product.id as string,
    soapProductId: soap.body.data.product.id as string,
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

describe('Supplier portal products API', () => {
  it('lists products supplied by the linked supplier only', async () => {
    const { supplierCookie, riceProductId } = await seedSuppliedProductsWorkspace();

    const response = await request(app)
      .get('/api/portal/supplier/products')
      .set('Cookie', supplierCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].productId).toBe(riceProductId);
    expect(response.body.data.items[0].name).toBe('Rice Bag');
    expect(response.body.data.items[0].totalUnitsSupplied).toBe(70);
    expect(response.body.data.items[0].supplyRecordCount).toBe(2);
    expect(response.body.data.pagination.total).toBe(1);
  });

  it('searches supplied products by name or sku', async () => {
    const { supplierCookie } = await seedSuppliedProductsWorkspace();

    const byName = await request(app)
      .get('/api/portal/supplier/products')
      .query({ search: 'Rice' })
      .set('Cookie', supplierCookie);
    expect(byName.status).toBe(200);
    expect(byName.body.data.items).toHaveLength(1);

    const bySku = await request(app)
      .get('/api/portal/supplier/products')
      .query({ search: 'SOAP-SUP' })
      .set('Cookie', supplierCookie);
    expect(bySku.status).toBe(200);
    expect(bySku.body.data.items).toHaveLength(0);
  });

  it('returns supply record detail for owned products only', async () => {
    const { supplierCookie, riceProductId, soapProductId } =
      await seedSuppliedProductsWorkspace();

    const owned = await request(app)
      .get(`/api/portal/supplier/products/${riceProductId}`)
      .set('Cookie', supplierCookie);
    expect(owned.status).toBe(200);
    expect(owned.body.data.product.product.name).toBe('Rice Bag');
    expect(owned.body.data.product.totalUnitsSupplied).toBe(70);
    expect(owned.body.data.product.supplyRecords).toHaveLength(2);

    const foreign = await request(app)
      .get(`/api/portal/supplier/products/${soapProductId}`)
      .set('Cookie', supplierCookie);
    expect(foreign.status).toBe(404);
  });

  it('rejects customer accounts from supplier product APIs', async () => {
    const { customerCookie, riceProductId } = await seedSuppliedProductsWorkspace();

    const list = await request(app)
      .get('/api/portal/supplier/products')
      .set('Cookie', customerCookie);
    expect(list.status).toBe(403);

    const detail = await request(app)
      .get(`/api/portal/supplier/products/${riceProductId}`)
      .set('Cookie', customerCookie);
    expect(detail.status).toBe(403);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/portal/supplier/products');
    expect(response.status).toBe(401);
  });
});
