import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'node:path';
import fs from 'node:fs';

import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import driversRoutes from './routes/drivers.routes.js';
import deliveriesRoutes from './routes/deliveries.routes.js';
import trackRoutes from './routes/track.routes.js';
import uploadsRoutes from './routes/uploads.routes.js';
import adminRoutes from './routes/admin.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import promoRoutes from './routes/promo.routes.js';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initSocket } from './socket/index.js';
import {
  expirePendingDeliveries,
  processScheduledDeliveries,
} from './services/delivery.service.js';
import { markStaleDriversOffline } from './services/driver.service.js';

const app = express();

// Helmet est desactive pour les uploads pour que le CORS cross-origin
// et la servie statique marchent proprement avec un CDN / nginx-proxy.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }),
);
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Service statique des uploads
const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? '/app/uploads';
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
app.use(
  '/uploads',
  express.static(UPLOAD_ROOT, {
    maxAge: '30d',
    immutable: true,
  }),
);
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
app.use('/api/track', trackRoutes); // public, no auth
app.use('/api/uploads', uploadsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/promo', promoRoutes);

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

    // Scan toutes les 30s pour passer en offline les livreurs sans heartbeat recent
    setInterval(() => {
      markStaleDriversOffline().catch((err) =>
        logger.error({ err }, 'markStaleDriversOffline failed'),
      );
    }, 30_000);

    // Scan toutes les 60s pour activer les livraisons programmees dont l'heure est arrivee
    setInterval(() => {
      processScheduledDeliveries().catch((err) =>
        logger.error({ err }, 'processScheduledDeliveries failed'),
      );
    }, 60_000);
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
