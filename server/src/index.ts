import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import driversRoutes from './routes/drivers.routes.js';
import deliveriesRoutes from './routes/deliveries.routes.js';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initSocket } from './socket/index.js';
import { expirePendingDeliveries } from './services/delivery.service.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  }),
);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/deliveries', deliveriesRoutes);

// 404 + error handling
app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);

async function start() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL via Prisma');
    server.listen(env.PORT, () => {
      logger.info(`Tolle API listening on :${env.PORT} (${env.NODE_ENV})`);
    });

    // Scan toutes les 30s pour expirer les demandes pending qui ont depasse expiresAt
    setInterval(() => {
      expirePendingDeliveries().catch((err) =>
        logger.error({ err }, 'expirePendingDeliveries failed'),
      );
    }, 30_000);
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down...');
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});

start();
