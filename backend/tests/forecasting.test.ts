import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { ensureOwnerManagerRole } from '../src/services/authService';

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
  await ensureOwnerManagerRole();
}

async function setup(email: string) {
  const register = await request(app).post('/api/auth/register').send({
    businessName: 'Forecast Shop',
    firstName: 'Fin',
    lastName: 'Owner',
    email,
    password: 'SecurePass1',
  });
  const cookie = register.headers['set-cookie'] as string[];

  const product = await request(app)
    .post('/api/products')
    .set('Cookie', cookie)
    .send({ name: 'Widget', sku: 'WID-1', price: 25 });

  await request(app)
    .post('/api/inventory/stock-in')
    .set('Cookie', cookie)
    .send({ productId: product.body.data.product.id, quantity: 10 });

  await request(app)
    .post('/api/sales')
    .set('Cookie', cookie)
    .send({ items: [{ productId: product.body.data.product.id, quantity: 2 }] });

  await request(app)
    .post('/api/expenses')
    .set('Cookie', cookie)
    .send({
      title: 'Rent',
      amount: 40,
      expenseDate: new Date().toISOString().slice(0, 10),
    });

  return { cookie, productId: product.body.data.product.id };
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

describe('Forecasting API', () => {
  it('returns average-based business and inventory projections from real history', async () => {
    const { cookie, productId } = await setup('forecast1@test.local');

    const response = await request(app)
      .get('/api/forecasting?months=6&horizon=3')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    const { forecasting } = response.body.data;
    expect(forecasting.methodology.label).toBe('Historical monthly average');
    expect(forecasting.historicalMonthly).toHaveLength(6);
    expect(forecasting.forecastMonthly).toHaveLength(3);
    expect(forecasting.summary.historicalAvgRevenue).toBeCloseTo(50 / 6, 2);
    expect(forecasting.summary.historicalAvgExpenses).toBeCloseTo(40 / 6, 2);
    expect(forecasting.summary.projectedRevenueTotal).toBeCloseTo((50 / 6) * 3, 1);
    expect(forecasting.summary.projectedExpensesTotal).toBeCloseTo((40 / 6) * 3, 1);
    expect(forecasting.dataQuality.monthsWithSales).toBe(1);
    expect(forecasting.dataQuality.hasEnoughHistory).toBe(true);
    expect(forecasting.inventoryForecasts.length).toBeGreaterThan(0);
    const productForecast = forecasting.inventoryForecasts.find(
      (row: { productId: string }) => row.productId === productId
    );
    expect(productForecast.currentQuantity).toBe(8);
    expect(productForecast.averageMonthlyDemand).toBeCloseTo(2 / 6, 2);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/forecasting');
    expect(response.status).toBe(401);
  });

  it('isolates forecasting data by business', async () => {
    const a = await setup('forecastA@test.local');
    await setup('forecastB@test.local');

    const response = await request(app).get('/api/forecasting').set('Cookie', a.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.forecasting.summary.historicalAvgRevenue).toBeCloseTo(50 / 6, 2);
  });
});
