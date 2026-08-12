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

async function seedAdministrator() {
  const { administratorRole } = await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Admin Test Biz',
      email: 'admin-biz@test.local',
    },
  });
  const passwordHash = await hashPassword('AdminPass1');
  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'admin@test.local',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      roles: {
        create: [{ roleId: administratorRole.id }],
      },
    },
  });
  return { business, email: 'admin@test.local', password: 'AdminPass1' };
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key-123456';
  process.env.NODE_ENV = 'test';
  process.env.CLIENT_ORIGIN = 'http://localhost:5173';
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Administrator role foundation', () => {
  it('creates OWNER_MANAGER and ADMINISTRATOR roles with distinct permissions', async () => {
    const ownerRole = await prisma.role.findUniqueOrThrow({
      where: { name: ROLE_OWNER_MANAGER },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { name: ROLE_ADMINISTRATOR },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    const ownerKeys = ownerRole.permissions.map((item) => item.permission.key).sort();
    const adminKeys = adminRole.permissions.map((item) => item.permission.key).sort();

    expect(ownerKeys).toEqual(
      OWNER_MANAGER_PERMISSIONS.map((item) => item.key).sort()
    );
    expect(adminKeys).toEqual(
      ADMINISTRATOR_PERMISSIONS.map((item) => item.key).sort()
    );
    expect(ownerKeys).toContain('sales.view');
    expect(adminKeys).toContain('users.view');
    expect(adminKeys).not.toContain('sales.view');
    expect(ownerKeys).not.toContain('users.view');
  });

  it('logs in administrator with admin permissions only', async () => {
    const { email, password } = await seedAdministrator();

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.data.user.roles).toContain(ROLE_ADMINISTRATOR);
    expect(login.body.data.user.permissions).toContain('users.view');
    expect(login.body.data.user.permissions).toContain('audit.view');
    expect(login.body.data.user.permissions).not.toContain('sales.view');
    expect(login.body.data.user.permissions).not.toContain('products.view');
  });

  it('allows administrator to access admin dashboard but not sales API', async () => {
    const { email, password } = await seedAdministrator();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const dashboard = await request(app).get('/api/admin/dashboard').set('Cookie', cookie);
    expect(dashboard.status).toBe(200);

    const ownerDashboard = await request(app).get('/api/dashboard').set('Cookie', cookie);
    expect(ownerDashboard.status).toBe(403);

    const sales = await request(app).get('/api/sales').set('Cookie', cookie);
    expect(sales.status).toBe(403);
  });
});
