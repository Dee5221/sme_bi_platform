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

async function seedAdminWorkspace() {
  const { ownerRole, administratorRole } = await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Admin Dashboard Co',
      email: 'admin-dash@test.local',
    },
  });

  const ownerHash = await hashPassword('OwnerPass1');
  const owner = await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'owner-admin-dash@test.local',
      passwordHash: ownerHash,
      firstName: 'Olivia',
      lastName: 'Owner',
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  const adminHash = await hashPassword('AdminPass1');
  const admin = await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'admin-admin-dash@test.local',
      passwordHash: adminHash,
      firstName: 'Sam',
      lastName: 'Admin',
      roles: { create: [{ roleId: administratorRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'inactive-admin-dash@test.local',
      passwordHash: adminHash,
      firstName: 'Inactive',
      lastName: 'User',
      isActive: false,
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  await writeAuditLog({
    businessId: business.id,
    actorId: admin.id,
    action: 'USER_LOGIN',
    entity: 'User',
    entityId: admin.id,
  });
  await writeAuditLog({
    businessId: business.id,
    actorId: owner.id,
    action: 'PRODUCT_CREATED',
    entity: 'Product',
    entityId: 'prod-1',
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

describe('Admin dashboard API', () => {
  it('returns user and activity KPIs from real tenant data', async () => {
    const { cookie, business } = await seedAdminWorkspace();

    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.dashboard.business.name).toBe(business.name);
    expect(response.body.data.dashboard.kpis.activeUsers).toBe(2);
    expect(response.body.data.dashboard.kpis.inactiveUsers).toBe(1);
    expect(response.body.data.dashboard.kpis.rolesInUse).toBe(2);
    expect(response.body.data.dashboard.kpis.auditEventsLast7Days).toBe(3);
    expect(response.body.data.dashboard.recentActivity).toHaveLength(3);
  });

  it('rejects owner access to admin dashboard', async () => {
    await seedAdminWorkspace();
    const ownerLogin = await request(app).post('/api/auth/login').send({
      email: 'owner-admin-dash@test.local',
      password: 'OwnerPass1',
    });

    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', ownerLogin.headers['set-cookie']);

    expect(response.status).toBe(403);
  });

  it('rejects admin access to owner operational dashboard', async () => {
    const { cookie } = await seedAdminWorkspace();

    const response = await request(app).get('/api/dashboard').set('Cookie', cookie);
    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/admin/dashboard');
    expect(response.status).toBe(401);
  });

  it('isolates admin dashboard data by business', async () => {
    const { cookie } = await seedAdminWorkspace();

    const otherBusiness = await prisma.business.create({
      data: { name: 'Other Biz', email: 'other-admin-dash@test.local' },
    });
    await writeAuditLog({
      businessId: otherBusiness.id,
      action: 'BUSINESS_CREATED',
      entity: 'Business',
      entityId: otherBusiness.id,
    });

    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.dashboard.kpis.auditEventsLast7Days).toBe(3);
    expect(response.body.data.dashboard.business.name).toBe('Admin Dashboard Co');
  });
});
