import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ROLE_STAFF,
  STAFF_PERMISSIONS,
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

async function seedStaff() {
  const { staffRole } = await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Staff Test Biz',
      email: 'staff-biz@test.local',
    },
  });
  const passwordHash = await hashPassword('StaffPass1');
  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'staff@test.local',
      passwordHash,
      firstName: 'Riley',
      lastName: 'Staff',
      roles: {
        create: [{ roleId: staffRole.id }],
      },
    },
  });
  return { business, email: 'staff@test.local', password: 'StaffPass1' };
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

describe('Staff role foundation', () => {
  it('creates STAFF with operational permissions only', async () => {
    const staffRole = await prisma.role.findUniqueOrThrow({
      where: { name: ROLE_STAFF },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    const staffKeys = staffRole.permissions.map((item) => item.permission.key).sort();
    expect(staffKeys).toEqual(STAFF_PERMISSIONS.map((item) => item.key).sort());
    expect(staffKeys).toContain('sales.view');
    expect(staffKeys).toContain('inventory.adjust');
    expect(staffKeys).not.toContain('users.view');
    expect(staffKeys).not.toContain('analytics.view');
    expect(staffKeys).not.toContain('expenses.view');
    expect(staffKeys).not.toContain('products.delete');
  });

  it('logs in staff with operational permissions only', async () => {
    const { email, password } = await seedStaff();

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.data.user.roles).toContain(ROLE_STAFF);
    expect(login.body.data.user.permissions).toContain('sales.create');
    expect(login.body.data.user.permissions).toContain('customers.view');
    expect(login.body.data.user.permissions).not.toContain('users.view');
    expect(login.body.data.user.permissions).not.toContain('reports.view');
  });

  it('allows staff to access sales and dashboard but not admin or expense APIs', async () => {
    const { email, password } = await seedStaff();
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];

    const dashboard = await request(app).get('/api/dashboard').set('Cookie', cookie);
    expect(dashboard.status).toBe(200);

    const sales = await request(app).get('/api/sales').set('Cookie', cookie);
    expect(sales.status).toBe(200);

    const users = await request(app).get('/api/users').set('Cookie', cookie);
    expect(users.status).toBe(403);

    const expenses = await request(app).get('/api/expenses').set('Cookie', cookie);
    expect(expenses.status).toBe(403);
  });
});
