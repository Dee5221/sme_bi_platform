import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
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

async function seedAdminSession() {
  const { ownerRole, administratorRole } = await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Settings Test Biz',
      email: 'settings-biz@test.local',
      phone: '+260900000000',
      address: 'Lusaka',
      usdToZmwRate: 18.5,
    },
  });

  const passwordHash = await hashPassword('AdminPass1');
  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'admin-settings@test.local',
      passwordHash,
      firstName: 'Sam',
      lastName: 'Admin',
      roles: { create: [{ roleId: administratorRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'owner-settings@test.local',
      passwordHash,
      firstName: 'Olivia',
      lastName: 'Owner',
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  const login = await request(app).post('/api/auth/login').send({
    email: 'admin-settings@test.local',
    password: 'AdminPass1',
  });

  return {
    business,
    cookie: login.headers['set-cookie'] as string[],
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

describe('Business settings API', () => {
  it('returns the authenticated tenant business', async () => {
    const { cookie, business } = await seedAdminSession();

    const response = await request(app).get('/api/business').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.business.id).toBe(business.id);
    expect(response.body.data.business.name).toBe('Settings Test Biz');
    expect(response.body.data.business.email).toBe('settings-biz@test.local');
    expect(response.body.data.business.usdToZmwRate).toBe(18.5);
  });

  it('updates business settings and writes an audit log', async () => {
    const { cookie, business } = await seedAdminSession();

    const response = await request(app)
      .put('/api/business')
      .set('Cookie', cookie)
      .send({
        name: 'Updated Settings Biz',
        email: 'updated-settings@test.local',
        phone: '+260911111111',
        address: 'Kitwe',
        usdToZmwRate: 19.25,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.business.name).toBe('Updated Settings Biz');
    expect(response.body.data.business.phone).toBe('+260911111111');
    expect(response.body.data.business.usdToZmwRate).toBe(19.25);

    const audit = await prisma.auditLog.findFirst({
      where: {
        businessId: business.id,
        action: 'business.updated',
        entityId: business.id,
      },
    });
    expect(audit).toBeTruthy();
  });

  it('rejects duplicate business emails', async () => {
    const { cookie } = await seedAdminSession();
    await prisma.business.create({
      data: {
        name: 'Other Settings Biz',
        email: 'taken-settings@test.local',
      },
    });

    const response = await request(app)
      .put('/api/business')
      .set('Cookie', cookie)
      .send({
        name: 'Settings Test Biz',
        email: 'taken-settings@test.local',
        usdToZmwRate: 18.5,
      });

    expect(response.status).toBe(409);
  });

  it('prevents deactivating the signed-in business', async () => {
    const { cookie } = await seedAdminSession();

    const response = await request(app)
      .put('/api/business')
      .set('Cookie', cookie)
      .send({
        name: 'Settings Test Biz',
        email: 'settings-biz@test.local',
        usdToZmwRate: 18.5,
        isActive: false,
      });

    expect(response.status).toBe(400);
  });

  it('allows owners to update the USD to Kwacha rate', async () => {
    await seedAdminSession();
    const ownerLogin = await request(app).post('/api/auth/login').send({
      email: 'owner-settings@test.local',
      password: 'AdminPass1',
    });
    const cookie = ownerLogin.headers['set-cookie'];

    const view = await request(app).get('/api/business').set('Cookie', cookie);
    expect(view.status).toBe(200);

    const update = await request(app)
      .put('/api/business')
      .set('Cookie', cookie)
      .send({
        name: 'Settings Test Biz',
        email: 'settings-biz@test.local',
        usdToZmwRate: 20,
      });
    expect(update.status).toBe(200);
    expect(update.body.data.business.usdToZmwRate).toBe(20);
  });

  it('isolates business settings by tenant', async () => {
    const { cookie } = await seedAdminSession();
    const other = await prisma.business.create({
      data: { name: 'Other Tenant', email: 'other-settings@test.local' },
    });

    const response = await request(app).get('/api/business').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.data.business.id).not.toBe(other.id);
    expect(response.body.data.business.name).toBe('Settings Test Biz');
  });
});
