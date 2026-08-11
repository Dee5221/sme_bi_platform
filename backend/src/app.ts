import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/authRoutes';
import { categoryRouter } from './routes/categoryRoutes';
import { customerRouter } from './routes/customerRoutes';
import { dashboardRouter } from './routes/dashboardRoutes';
import { expenseRouter } from './routes/expenseRoutes';
import { inventoryRouter } from './routes/inventoryRoutes';
import { productRouter } from './routes/productRoutes';
import { profileRouter } from './routes/profileRoutes';
import { saleRouter } from './routes/saleRoutes';
import { supplierRouter } from './routes/supplierRoutes';
import { sendSuccess } from './lib/apiResponse';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === 'test' ? 'tiny' : 'dev'));

  app.get('/api/health', (_req, res) => {
    sendSuccess(res, { status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/product-categories', categoryRouter);
  app.use('/api/products', productRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/customers', customerRouter);
  app.use('/api/suppliers', supplierRouter);
  app.use('/api/sales', saleRouter);
  app.use('/api/expenses', expenseRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
