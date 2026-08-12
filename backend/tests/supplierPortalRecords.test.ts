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

async function seedSupplierRecordsWorkspace() {
  const { ownerRole, externalCustomerRole, externalSupplierRole } =
    await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Supplier Records Co',
      email: 'supplier-records-co@test.local',
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
      email: 'owner-supplier-records@test.local',
      passwordHash,
      firstName: 'Olivia',
      lastName: 'Owner',
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'customer-supplier-records@test.local',
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
      email: 'supplier-supplier-records@test.local',
      passwordHash,
      firstName: 'Sid',
      lastName: 'Supplier',
      accountType: ACCOUNT_TYPE_SUPPLIER,
      supplierId: supplier.id,
      roles: { create: [{ roleId: externalSupplierRole.id }] },
    },
  });

  const ownerLogin = await request(app).post('/api/auth/login').send({
    email: 'owner-supplier-records@test.local',
    password: 'PortalPass1',
  });
  const ownerCookie = ownerLogin.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', ownerCookie)
    .send({ name: 'Rice Bag', sku: 'RICE-REC', price: 20 });

  const ownRecord = await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', ownerCookie)
    .send({
      productId: product.body.data.product.id,
      quantity: 50,
      supplierId: supplier.id,
      reason: 'Portal delivery alpha',
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
    email: 'supplier-supplier-records@test.local',
    password: 'PortalPass1',
  });

  const customerLogin = await request(app).post('/api/auth/login').send({
    email: 'customer-supplier-records@test.local',
    password: 'PortalPass1',
  });

  return {
    supplierCookie: supplierLogin.headers['set-cookie'] as string[],
    customerCookie: customerLogin.headers['set-cookie'] as string[],
    ownRecordId: ownRecord.body.data.movement.id as string,
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

describe('Supplier portal records API', () => {
  it('lists purchase records scoped to the linked supplier only', async () => {
    const { supplierCookie, ownRecordId } = await seedSupplierRecordsWorkspace();

    const response = await request(app)
      .get('/api/portal/supplier/records')
      .set('Cookie', supplierCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].id).toBe(ownRecordId);
    expect(response.body.data.items[0].productName).toBe('Rice Bag');
    expect(response.body.data.items[0].quantity).toBe(50);
    expect(response.body.data.items[0].reason).toBe('Portal delivery alpha');
    expect(response.body.data.pagination.total).toBe(1);
  });

  it('searches records by product or reason', async () => {
    const { supplierCookie } = await seedSupplierRecordsWorkspace();

    const byReason = await request(app)
      .get('/api/portal/supplier/records')
      .query({ search: 'alpha' })
      .set('Cookie', supplierCookie);
    expect(byReason.status).toBe(200);
    expect(byReason.body.data.items).toHaveLength(1);

    const byProduct = await request(app)
      .get('/api/portal/supplier/records')
      .query({ search: 'Rice' })
      .set('Cookie', supplierCookie);
    expect(byProduct.status).toBe(200);
    expect(byProduct.body.data.items).toHaveLength(1);

    const noMatch = await request(app)
      .get('/api/portal/supplier/records')
      .query({ search: 'Other supplier delivery' })
      .set('Cookie', supplierCookie);
    expect(noMatch.status).toBe(200);
    expect(noMatch.body.data.items).toHaveLength(0);
  });

  it('returns record detail for owned records only', async () => {
    const { supplierCookie, ownRecordId } = await seedSupplierRecordsWorkspace();

    const owned = await request(app)
      .get(`/api/portal/supplier/records/${ownRecordId}`)
      .set('Cookie', supplierCookie);
    expect(owned.status).toBe(200);
    expect(owned.body.data.record.productSku).toBe('RICE-REC');
    expect(owned.body.data.record.quantity).toBe(50);

    const foreign = await prisma.stockMovement.findFirst({
      where: { reason: 'Other supplier delivery' },
      select: { id: true },
    });

    const blocked = await request(app)
      .get(`/api/portal/supplier/records/${foreign!.id}`)
      .set('Cookie', supplierCookie);
    expect(blocked.status).toBe(404);
  });

  it('rejects customer accounts from supplier record APIs', async () => {
    const { customerCookie, ownRecordId } = await seedSupplierRecordsWorkspace();

    const list = await request(app)
      .get('/api/portal/supplier/records')
      .set('Cookie', customerCookie);
    expect(list.status).toBe(403);

    const detail = await request(app)
      .get(`/api/portal/supplier/records/${ownRecordId}`)
      .set('Cookie', customerCookie);
    expect(detail.status).toBe(403);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/portal/supplier/records');
    expect(response.status).toBe(401);
  });
});
