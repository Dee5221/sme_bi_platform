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

async function seedPurchasesWorkspace() {
  const { ownerRole, externalCustomerRole, externalSupplierRole } =
    await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Portal Purchases Co',
      email: 'portal-purchases-co@test.local',
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
      email: 'owner-portal-purchases@test.local',
      passwordHash,
      firstName: 'Olivia',
      lastName: 'Owner',
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'customer-portal-purchases@test.local',
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
      email: 'supplier-portal-purchases@test.local',
      passwordHash,
      firstName: 'Sid',
      lastName: 'Supplier',
      accountType: ACCOUNT_TYPE_SUPPLIER,
      supplierId: supplier.id,
      roles: { create: [{ roleId: externalSupplierRole.id }] },
    },
  });

  const ownerLogin = await request(app).post('/api/auth/login').send({
    email: 'owner-portal-purchases@test.local',
    password: 'PortalPass1',
  });
  const ownerCookie = ownerLogin.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', ownerCookie)
    .send({ name: 'Notebook', sku: 'NB-PURCHASE', price: 15 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', ownerCookie)
    .send({ productId: product.body.data.product.id, quantity: 20 });

  const ownPurchase = await request(app)
    .post('/api/sales')
    .set('Cookie', ownerCookie)
    .send({
      customerId: customer.id,
      notes: 'Portal order alpha',
      items: [{ productId: product.body.data.product.id, quantity: 2 }],
    });

  await request(app)
    .post('/api/sales')
    .set('Cookie', ownerCookie)
    .send({
      customerId: otherCustomer.id,
      notes: 'Other customer order',
      items: [{ productId: product.body.data.product.id, quantity: 5 }],
    });

  const customerLogin = await request(app).post('/api/auth/login').send({
    email: 'customer-portal-purchases@test.local',
    password: 'PortalPass1',
  });

  const supplierLogin = await request(app).post('/api/auth/login').send({
    email: 'supplier-portal-purchases@test.local',
    password: 'PortalPass1',
  });

  return {
    customer,
    ownPurchaseId: ownPurchase.body.data.sale.id as string,
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

describe('Customer portal purchases API', () => {
  it('lists purchases scoped to the linked customer only', async () => {
    const { customerCookie, ownPurchaseId } = await seedPurchasesWorkspace();

    const response = await request(app)
      .get('/api/portal/customer/purchases')
      .set('Cookie', customerCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].id).toBe(ownPurchaseId);
    expect(response.body.data.items[0].total).toBe(30);
    expect(response.body.data.items[0].notes).toBe('Portal order alpha');
    expect(response.body.data.pagination.total).toBe(1);
  });

  it('searches purchases by sale number, notes, or product', async () => {
    const { customerCookie } = await seedPurchasesWorkspace();

    const byNotes = await request(app)
      .get('/api/portal/customer/purchases')
      .query({ search: 'alpha' })
      .set('Cookie', customerCookie);
    expect(byNotes.status).toBe(200);
    expect(byNotes.body.data.items).toHaveLength(1);

    const byProduct = await request(app)
      .get('/api/portal/customer/purchases')
      .query({ search: 'Notebook' })
      .set('Cookie', customerCookie);
    expect(byProduct.status).toBe(200);
    expect(byProduct.body.data.items).toHaveLength(1);

    const noMatch = await request(app)
      .get('/api/portal/customer/purchases')
      .query({ search: 'Other customer order' })
      .set('Cookie', customerCookie);
    expect(noMatch.status).toBe(200);
    expect(noMatch.body.data.items).toHaveLength(0);
  });

  it('returns purchase detail for owned purchases only', async () => {
    const { customerCookie, ownPurchaseId } = await seedPurchasesWorkspace();

    const owned = await request(app)
      .get(`/api/portal/customer/purchases/${ownPurchaseId}`)
      .set('Cookie', customerCookie);
    expect(owned.status).toBe(200);
    expect(owned.body.data.purchase.items).toHaveLength(1);
    expect(owned.body.data.purchase.items[0].productName).toBe('Notebook');

    const otherSale = await prisma.sale.findFirst({
      where: { notes: 'Other customer order' },
      select: { id: true },
    });

    const foreign = await request(app)
      .get(`/api/portal/customer/purchases/${otherSale!.id}`)
      .set('Cookie', customerCookie);
    expect(foreign.status).toBe(404);
  });

  it('rejects supplier accounts from customer purchase APIs', async () => {
    const { supplierCookie, ownPurchaseId } = await seedPurchasesWorkspace();

    const list = await request(app)
      .get('/api/portal/customer/purchases')
      .set('Cookie', supplierCookie);
    expect(list.status).toBe(403);

    const detail = await request(app)
      .get(`/api/portal/customer/purchases/${ownPurchaseId}`)
      .set('Cookie', supplierCookie);
    expect(detail.status).toBe(403);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/portal/customer/purchases');
    expect(response.status).toBe(401);
  });
});
