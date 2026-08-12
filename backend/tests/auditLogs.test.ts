import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { writeAuditLog } from '../src/lib/audit';
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
      name: 'Audit Test Biz',
      email: 'audit-biz@test.local',
    },
  });

  const passwordHash = await hashPassword('AdminPass1');
  const admin = await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'admin-audit@test.local',
      passwordHash,
      firstName: 'Sam',
      lastName: 'Admin',
      roles: { create: [{ roleId: administratorRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'owner-audit@test.local',
      passwordHash,
      firstName: 'Olivia',
      lastName: 'Owner',
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  await writeAuditLog({
    businessId: business.id,
    actorId: admin.id,
    action: 'user.created',
    entity: 'User',
    entityId: admin.id,
  });
  await writeAuditLog({
    businessId: business.id,
    actorId: admin.id,
    action: 'role.permissions.updated',
    entity: 'Role',
    entityId: ownerRole.id,
  });

  const login = await request(app).post('/api/auth/login').send({
    email: admin.email,
    password: 'AdminPass1',
  });

  return {
    business,
    admin,
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

describe('Audit logs API', () => {
  it('lists tenant activity with actor names and filter options', async () => {
    const { cookie } = await seedAdminSession();

    const response = await request(app).get('/api/audit-logs').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(response.body.data.filters.actions).toEqual(
      expect.arrayContaining(['user.created', 'role.permissions.updated', 'user.login'])
    );
    expect(response.body.data.filters.entities).toEqual(
      expect.arrayContaining(['User', 'Role'])
    );
    expect(response.body.data.items[0].actorName).toBeTruthy();
  });

  it('filters by action and search', async () => {
    const { cookie } = await seedAdminSession();

    const byAction = await request(app)
      .get('/api/audit-logs?action=user.created')
      .set('Cookie', cookie);
    expect(byAction.status).toBe(200);
    expect(byAction.body.data.items.every((item: { action: string }) => item.action === 'user.created')).toBe(
      true
    );

    const bySearch = await request(app)
      .get('/api/audit-logs?search=Sam')
      .set('Cookie', cookie);
    expect(bySearch.status).toBe(200);
    expect(bySearch.body.data.items.length).toBeGreaterThan(0);
  });

  it('rejects owner access', async () => {
    await seedAdminSession();
    const ownerLogin = await request(app).post('/api/auth/login').send({
      email: 'owner-audit@test.local',
      password: 'AdminPass1',
    });

    const response = await request(app)
      .get('/api/audit-logs')
      .set('Cookie', ownerLogin.headers['set-cookie']);

    expect(response.status).toBe(403);
  });

  it('isolates audit logs by business', async () => {
    const { cookie } = await seedAdminSession();

    const otherBusiness = await prisma.business.create({
      data: { name: 'Other Audit Biz', email: 'other-audit@test.local' },
    });
    await writeAuditLog({
      businessId: otherBusiness.id,
      action: 'business.created',
      entity: 'Business',
      entityId: otherBusiness.id,
    });

    const response = await request(app).get('/api/audit-logs').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(
      response.body.data.items.some((item: { action: string }) => item.action === 'business.created')
    ).toBe(false);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/audit-logs');
    expect(response.status).toBe(401);
  });
});
