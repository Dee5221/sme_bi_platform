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

async function registerAndCookie(email = 'owner@profile.test') {
  const response = await request(app).post('/api/auth/register').send({
    businessName: 'Profile Shop',
    firstName: 'Pat',
    lastName: 'Owner',
    email,
    password: 'SecurePass1',
  });
  return {
    cookie: response.headers['set-cookie'] as string[],
    user: response.body.data.user,
  };
}

beforeAll(() => {
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

describe('Profile API', () => {
  it('returns the authenticated user profile', async () => {
    const { cookie } = await registerAndCookie();
    const response = await request(app).get('/api/profile').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe('owner@profile.test');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.business.name).toBe('Profile Shop');
  });

  it('updates profile fields for the authenticated user only', async () => {
    const { cookie } = await registerAndCookie();
    const response = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({
        firstName: 'Patricia',
        lastName: 'Manager',
        email: 'patricia@profile.test',
        phone: '+260911000111',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user.firstName).toBe('Patricia');
    expect(response.body.data.user.email).toBe('patricia@profile.test');
    expect(response.body.data.user.phone).toBe('+260911000111');
  });

  it('rejects profile update when email already exists', async () => {
    await registerAndCookie('alpha@profile.test');
    const { cookie } = await registerAndCookie('beta@profile.test');

    const response = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({
        firstName: 'Beta',
        lastName: 'Owner',
        email: 'alpha@profile.test',
      });

    expect(response.status).toBe(409);
  });

  it('changes password with valid current password', async () => {
    const { cookie } = await registerAndCookie('pwd@profile.test');

    const change = await request(app)
      .put('/api/profile/password')
      .set('Cookie', cookie)
      .send({
        currentPassword: 'SecurePass1',
        newPassword: 'NewSecure2',
        confirmPassword: 'NewSecure2',
      });

    expect(change.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({
      email: 'pwd@profile.test',
      password: 'SecurePass1',
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({
      email: 'pwd@profile.test',
      password: 'NewSecure2',
    });
    expect(newLogin.status).toBe(200);
  });

  it('rejects password change with wrong current password', async () => {
    const { cookie } = await registerAndCookie('wrongpwd@profile.test');

    const response = await request(app)
      .put('/api/profile/password')
      .set('Cookie', cookie)
      .send({
        currentPassword: 'WrongPass1',
        newPassword: 'NewSecure2',
        confirmPassword: 'NewSecure2',
      });

    expect(response.status).toBe(400);
  });

  it('rejects unauthenticated profile access', async () => {
    const response = await request(app).get('/api/profile');
    expect(response.status).toBe(401);
  });

  it('lets an administrator view and update their own profile', async () => {
    const { administratorRole } = await ensureSystemRoles();
    const business = await prisma.business.create({
      data: { name: 'Admin Profile Biz', email: 'admin-profile-biz@test.local' },
    });
    await prisma.user.create({
      data: {
        businessId: business.id,
        email: 'admin-profile@test.local',
        passwordHash: await hashPassword('AdminPass1'),
        firstName: 'Sam',
        lastName: 'Admin',
        roles: { create: [{ roleId: administratorRole.id }] },
      },
    });

    const login = await request(app).post('/api/auth/login').send({
      email: 'admin-profile@test.local',
      password: 'AdminPass1',
    });
    const cookie = login.headers['set-cookie'];

    const me = await request(app).get('/api/profile').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('admin-profile@test.local');
    expect(me.body.data.user.roles).toContain('ADMINISTRATOR');

    const updated = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({
        firstName: 'Samuel',
        lastName: 'Admin',
        email: 'admin-profile@test.local',
        phone: '+260922000000',
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.user.firstName).toBe('Samuel');
    expect(updated.body.data.user.phone).toBe('+260922000000');
  });
});
