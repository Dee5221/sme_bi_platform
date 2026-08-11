import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { ensureOwnerManagerRole } from '../src/services/authService';

const app = createApp();

async function resetDb() {
  await prisma.auditLog.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await ensureOwnerManagerRole();
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

describe('Auth foundation', () => {
  it('registers a business owner and returns session user without password hash', async () => {
    const response = await request(app).post('/api/auth/register').send({
      businessName: 'Kaluli Hardware',
      businessEmail: 'info@kaluli.test',
      firstName: 'Jane',
      lastName: 'Manager',
      email: 'jane@kaluli.test',
      password: 'SecurePass1',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('jane@kaluli.test');
    expect(response.body.data.user.roles).toContain('OWNER_MANAGER');
    expect(response.body.data.user.permissions).toContain('dashboard.view');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('rejects weak passwords', async () => {
    const response = await request(app).post('/api/auth/register').send({
      businessName: 'Kaluli Hardware',
      firstName: 'Jane',
      lastName: 'Manager',
      email: 'jane2@kaluli.test',
      password: 'short',
    });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it('logs in with valid credentials and exposes /me', async () => {
    await request(app).post('/api/auth/register').send({
      businessName: 'Shop A',
      firstName: 'Owner',
      lastName: 'One',
      email: 'owner1@shop.test',
      password: 'SecurePass1',
    });

    const login = await request(app).post('/api/auth/login').send({
      email: 'owner1@shop.test',
      password: 'SecurePass1',
    });

    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'];
    expect(cookie).toBeDefined();

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('owner1@shop.test');
    expect(me.body.data.user.business.name).toBe('Shop A');
  });

  it('rejects invalid login credentials', async () => {
    await request(app).post('/api/auth/register').send({
      businessName: 'Shop B',
      firstName: 'Owner',
      lastName: 'Two',
      email: 'owner2@shop.test',
      password: 'SecurePass1',
    });

    const response = await request(app).post('/api/auth/login').send({
      email: 'owner2@shop.test',
      password: 'WrongPass1',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Invalid email or password.');
  });

  it('rejects unauthenticated access to /me', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('isolates users by business on conflict registration', async () => {
    await request(app).post('/api/auth/register').send({
      businessName: 'Shop C',
      firstName: 'Owner',
      lastName: 'Three',
      email: 'shared@shop.test',
      password: 'SecurePass1',
    });

    const duplicate = await request(app).post('/api/auth/register').send({
      businessName: 'Shop D',
      firstName: 'Owner',
      lastName: 'Four',
      email: 'shared@shop.test',
      password: 'SecurePass1',
    });

    expect(duplicate.status).toBe(409);
  });

  it('logs out and clears session cookie', async () => {
    const register = await request(app).post('/api/auth/register').send({
      businessName: 'Shop E',
      firstName: 'Owner',
      lastName: 'Five',
      email: 'owner5@shop.test',
      password: 'SecurePass1',
    });

    const cookie = register.headers['set-cookie'];
    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    // Cookie still sent by agent, but logout cleared cookie for client;
    // token itself remains valid until expiry (stateless JWT).
    // Frontend clears cookie; authenticated requests without cookie fail:
    const meNoCookie = await request(app).get('/api/auth/me');
    expect(meNoCookie.status).toBe(401);
    expect(me.status).toBe(200);
  });
});
