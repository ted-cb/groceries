import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth';
import { listsRouter } from './routes/lists';
import { itemsRouter } from './routes/items';
import { categoriesRouter } from './routes/categories';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    app.use(
      cors({
        origin: corsOrigin.split(',').map((o) => o.trim()),
        credentials: true,
      })
    );
  }

  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/ping', (_req, res) => {
    res.json({ message: 'pong' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/lists', listsRouter);
  app.use('/api/items', itemsRouter);
  app.use('/api/categories', categoriesRouter);

  app.use(errorHandler);

  return app;
}
