import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ADMINISTRATOR_PERMISSIONS,
  OWNER_MANAGER_PERMISSIONS,
  ROLE_ADMINISTRATOR,
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
      name: 'Roles Test Biz',
      email: 'roles-biz@test.local',
    },
  });

  const passwordHash = await hashPassword('AdminPass1');
  const admin = await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'admin-roles@test.local',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      roles: { create: [{ roleId: administratorRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'owner-roles@test.local',
      passwordHash,
      firstName: 'Owner',
      lastName: 'User',
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  const login = await request(app).post('/api/auth/login').send({
    email: admin.email,
    password: 'AdminPass1',
  });

  return {
    business,
    admin,
    ownerRole,
    administratorRole,
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

describe('Roles API', () => {
  it('lists system roles with permission catalog', async () => {
    const { cookie } = await seedAdminSession();

    const response = await request(app).get('/api/roles').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.roles).toHaveLength(5);
    expect(response.body.data.permissions.length).toBeGreaterThan(20);

    const ownerRole = response.body.data.roles.find(
      (item: { name: string }) => item.name === ROLE_OWNER_MANAGER
    );
    const adminRole = response.body.data.roles.find(
      (item: { name: string }) => item.name === ROLE_ADMINISTRATOR
    );

    expect(ownerRole.permissionKeys).toEqual(
      OWNER_MANAGER_PERMISSIONS.map((item) => item.key).sort()
    );
    expect(adminRole.permissionKeys).toEqual(
      ADMINISTRATOR_PERMISSIONS.map((item) => item.key).sort()
    );
  });

  it('updates role permissions and writes audit log', async () => {
    const { cookie, business, admin, ownerRole } = await seedAdminSession();

    const nextKeys = ['dashboard.view', 'products.view', 'profile.view'];
    const response = await request(app)
      .put(`/api/roles/${ownerRole.id}/permissions`)
      .set('Cookie', cookie)
      .send({ permissionKeys: nextKeys });

    expect(response.status).toBe(200);
    expect(response.body.data.role.permissionKeys.sort()).toEqual(nextKeys.sort());

    const audit = await prisma.auditLog.findFirst({
      where: {
        businessId: business.id,
        actorId: admin.id,
        action: 'role.permissions.updated',
        entityId: ownerRole.id,
      },
    });
    expect(audit).toBeTruthy();
  });

  it('rejects removing all permissions from a role', async () => {
    const { cookie, ownerRole } = await seedAdminSession();

    const response = await request(app)
      .put(`/api/roles/${ownerRole.id}/permissions`)
      .set('Cookie', cookie)
      .send({ permissionKeys: [] });

    expect(response.status).toBe(422);
  });

  it('rejects owner access to roles management', async () => {
    await seedAdminSession();
    const ownerLogin = await request(app).post('/api/auth/login').send({
      email: 'owner-roles@test.local',
      password: 'AdminPass1',
    });

    const response = await request(app)
      .get('/api/roles')
      .set('Cookie', ownerLogin.headers['set-cookie']);

    expect(response.status).toBe(403);
  });

  it('allows view-only administrators to list but not update roles', async () => {
    const { administratorRole } = await ensureSystemRoles();
    const business = await prisma.business.create({
      data: { name: 'View Only Biz', email: 'viewonly-biz@test.local' },
    });

    const viewOnlyPermission = await prisma.permission.findUniqueOrThrow({
      where: { key: 'roles.view' },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: administratorRole.id } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: administratorRole.id, permissionId: viewOnlyPermission.id },
        {
          roleId: administratorRole.id,
          permissionId: (await prisma.permission.findUniqueOrThrow({
            where: { key: 'dashboard.view' },
          })).id,
        },
      ],
    });

    const passwordHash = await hashPassword('AdminPass1');
    await prisma.user.create({
      data: {
        businessId: business.id,
        email: 'viewonly-admin@test.local',
        passwordHash,
        firstName: 'View',
        lastName: 'Only',
        roles: { create: [{ roleId: administratorRole.id }] },
      },
    });

    const login = await request(app).post('/api/auth/login').send({
      email: 'viewonly-admin@test.local',
      password: 'AdminPass1',
    });
    const cookie = login.headers['set-cookie'];

    const list = await request(app).get('/api/roles').set('Cookie', cookie);
    expect(list.status).toBe(200);

    const ownerRole = await prisma.role.findUniqueOrThrow({
      where: { name: ROLE_OWNER_MANAGER },
    });
    const update = await request(app)
      .put(`/api/roles/${ownerRole.id}/permissions`)
      .set('Cookie', cookie)
      .send({ permissionKeys: ['dashboard.view'] });

    expect(update.status).toBe(403);
  });
});
