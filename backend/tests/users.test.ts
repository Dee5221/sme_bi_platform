import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ROLE_ADMINISTRATOR, ROLE_OWNER_MANAGER } from '../src/constants/permissions';
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
      name: 'Users Test Biz',
      email: 'users-biz@test.local',
    },
  });

  const passwordHash = await hashPassword('AdminPass1');
  const admin = await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'admin-users@test.local',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      roles: { create: [{ roleId: administratorRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'owner-users@test.local',
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

describe('Users API', () => {
  it('lists assignable roles and users for an administrator', async () => {
    const { cookie } = await seedAdminSession();

    const roles = await request(app).get('/api/users/roles').set('Cookie', cookie);
    expect(roles.status).toBe(200);
    expect(roles.body.data.roles.map((item: { name: string }) => item.name)).toEqual(
      expect.arrayContaining([ROLE_OWNER_MANAGER, ROLE_ADMINISTRATOR])
    );

    const list = await request(app).get('/api/users?status=ALL').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it('creates a user with role assignment', async () => {
    const { cookie, ownerRole } = await seedAdminSession();

    const created = await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({
        firstName: 'Taylor',
        lastName: 'Staff',
        email: 'taylor-users@test.local',
        password: 'StaffPass1',
        roleIds: [ownerRole.id],
      });

    expect(created.status).toBe(201);
    expect(created.body.data.user.email).toBe('taylor-users@test.local');
    expect(created.body.data.user.roles).toContain(ROLE_OWNER_MANAGER);
  });

  it('updates a user and can reactivate them', async () => {
    const { cookie, ownerRole, administratorRole } = await seedAdminSession();

    const created = await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({
        firstName: 'Jordan',
        lastName: 'Ops',
        email: 'jordan-users@test.local',
        password: 'StaffPass1',
        roleIds: [ownerRole.id],
      });

    const userId = created.body.data.user.id;

    await request(app).delete(`/api/users/${userId}`).set('Cookie', cookie);

    const updated = await request(app)
      .put(`/api/users/${userId}`)
      .set('Cookie', cookie)
      .send({
        firstName: 'Jordan',
        lastName: 'Ops',
        email: 'jordan-users@test.local',
        roleIds: [administratorRole.id],
        isActive: true,
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.user.isActive).toBe(true);
    expect(updated.body.data.user.roles).toContain(ROLE_ADMINISTRATOR);
  });

  it('rejects duplicate email addresses', async () => {
    const { cookie, ownerRole } = await seedAdminSession();

    const duplicate = await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({
        firstName: 'Dup',
        lastName: 'User',
        email: 'owner-users@test.local',
        password: 'StaffPass1',
        roleIds: [ownerRole.id],
      });

    expect(duplicate.status).toBe(409);
  });

  it('prevents owner access to user management', async () => {
    await seedAdminSession();
    const ownerLogin = await request(app).post('/api/auth/login').send({
      email: 'owner-users@test.local',
      password: 'AdminPass1',
    });

    const response = await request(app)
      .get('/api/users')
      .set('Cookie', ownerLogin.headers['set-cookie']);

    expect(response.status).toBe(403);
  });

  it('returns user details with recent activity', async () => {
    const { cookie, ownerRole } = await seedAdminSession();

    const created = await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({
        firstName: 'Detail',
        lastName: 'User',
        email: 'detail-users@test.local',
        password: 'StaffPass1',
        roleIds: [ownerRole.id],
      });

    const userId = created.body.data.user.id;

    await request(app).post('/api/auth/login').send({
      email: 'detail-users@test.local',
      password: 'StaffPass1',
    });

    const response = await request(app)
      .get(`/api/users/${userId}`)
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe('detail-users@test.local');
    expect(response.body.data.recentActivity.length).toBeGreaterThan(0);
    expect(
      response.body.data.recentActivity.some(
        (entry: { action: string }) => entry.action === 'user.created'
      )
    ).toBe(true);
  });

  it('prevents cross-business user details access', async () => {
    const { cookie, ownerRole } = await seedAdminSession();

    const created = await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({
        firstName: 'Scoped',
        lastName: 'User',
        email: 'scoped-users@test.local',
        password: 'StaffPass1',
        roleIds: [ownerRole.id],
      });

    const otherBusiness = await prisma.business.create({
      data: { name: 'Other Users Biz', email: 'other-users-biz@test.local' },
    });
    const { administratorRole } = await ensureSystemRoles();
    const otherAdmin = await prisma.user.create({
      data: {
        businessId: otherBusiness.id,
        email: 'other-admin-users@test.local',
        passwordHash: await hashPassword('AdminPass1'),
        firstName: 'Other',
        lastName: 'Admin',
        roles: { create: [{ roleId: administratorRole.id }] },
      },
    });
    const otherLogin = await request(app).post('/api/auth/login').send({
      email: otherAdmin.email,
      password: 'AdminPass1',
    });

    const forbidden = await request(app)
      .get(`/api/users/${created.body.data.user.id}`)
      .set('Cookie', otherLogin.headers['set-cookie']);

    expect(forbidden.status).toBe(404);
  });

  it('prevents an administrator from deactivating their own account', async () => {
    const { cookie, admin } = await seedAdminSession();

    const response = await request(app)
      .delete(`/api/users/${admin.id}`)
      .set('Cookie', cookie);

    expect(response.status).toBe(400);
  });
});
