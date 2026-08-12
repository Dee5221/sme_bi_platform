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

async function seedStaffWorkspace() {
  const { ownerRole, staffRole } = await ensureSystemRoles();
  const business = await prisma.business.create({
    data: {
      name: 'Staff Dashboard Co',
      email: 'staff-dash@test.local',
    },
  });

  const passwordHash = await hashPassword('StaffPass1');
  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'owner-staff-dash@test.local',
      passwordHash,
      firstName: 'Olivia',
      lastName: 'Owner',
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'staff-staff-dash@test.local',
      passwordHash,
      firstName: 'Riley',
      lastName: 'Staff',
      roles: { create: [{ roleId: staffRole.id }] },
    },
  });

  const ownerLogin = await request(app).post('/api/auth/login').send({
    email: 'owner-staff-dash@test.local',
    password: 'StaffPass1',
  });
  const ownerCookie = ownerLogin.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', ownerCookie)
    .send({ name: 'Soap', sku: 'SOAP-STAFF', price: 25 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', ownerCookie)
    .send({ productId: product.body.data.product.id, quantity: 4 });

  await request(app)
    .post('/api/sales')
    .set('Cookie', ownerCookie)
    .send({ items: [{ productId: product.body.data.product.id, quantity: 2 }] });

  await request(app)
    .post('/api/expenses')
    .set('Cookie', ownerCookie)
    .send({
      title: 'Transport',
      amount: 40,
      expenseDate: new Date().toISOString().slice(0, 10),
    });

  const staffLogin = await request(app).post('/api/auth/login').send({
    email: 'staff-staff-dash@test.local',
    password: 'StaffPass1',
  });

  return {
    business,
    ownerCookie,
    staffCookie: staffLogin.headers['set-cookie'] as string[],
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

describe('Staff dashboard API', () => {
  it('returns operational KPIs without expense data', async () => {
    const { staffCookie, business } = await seedStaffWorkspace();

    const response = await request(app)
      .get('/api/staff/dashboard')
      .set('Cookie', staffCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.dashboard.business.name).toBe(business.name);
    expect(response.body.data.dashboard.kpis.todaySaleCount).toBe(1);
    expect(response.body.data.dashboard.kpis.todayRevenue).toBe(50);
    expect(response.body.data.dashboard.kpis.monthSaleCount).toBe(1);
    expect(response.body.data.dashboard.kpis.monthRevenue).toBe(50);
    expect(response.body.data.dashboard.kpis.activeProducts).toBe(1);
    expect(response.body.data.dashboard.kpis.lowStockCount).toBe(1);
    expect(response.body.data.dashboard.kpis.expenses).toBeUndefined();
    expect(response.body.data.dashboard.recentSales).toHaveLength(1);
  });

  it('rejects staff access to the owner operational dashboard', async () => {
    const { staffCookie } = await seedStaffWorkspace();

    const response = await request(app).get('/api/dashboard').set('Cookie', staffCookie);
    expect(response.status).toBe(403);
  });

  it('rejects owner-only expense leakage on staff dashboard', async () => {
    const { staffCookie } = await seedStaffWorkspace();

    const response = await request(app)
      .get('/api/staff/dashboard')
      .set('Cookie', staffCookie);

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('Transport');
    expect(JSON.stringify(response.body.data.dashboard.kpis)).not.toContain('expense');
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/staff/dashboard');
    expect(response.status).toBe(401);
  });

  it('isolates staff dashboard data by business', async () => {
    const { staffCookie } = await seedStaffWorkspace();

    const other = await prisma.business.create({
      data: { name: 'Other Staff Dash', email: 'other-staff-dash@test.local' },
    });
    await prisma.sale.create({
      data: {
        businessId: other.id,
        saleNumber: 'OTHER-1',
        status: 'COMPLETED',
        subtotal: 999,
        total: 999,
        soldAt: new Date(),
      },
    });

    const response = await request(app)
      .get('/api/staff/dashboard')
      .set('Cookie', staffCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.dashboard.kpis.monthRevenue).toBe(50);
    expect(response.body.data.dashboard.business.name).toBe('Staff Dashboard Co');
  });
});
