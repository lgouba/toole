import * as Sentry from '@sentry/node';
import { env } from '../config/env.js';

/**
 * Initialisation Sentry pour le serveur Tollé.
 *
 * IMPORTANT : doit etre appele AVANT tout autre import d'Express, pour que
 * l'instrumentation auto (http, express, prisma) puisse hook les bons modules.
 *
 * - DSN passe via SENTRY_DSN dans le .env serveur (pas en dur dans le code).
 *   Permet de desactiver Sentry en dev / staging en ne settant pas la var.
 * - Skip si NODE_ENV !== 'production' : on n'envoie pas les crashs de dev.
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] init skipped (no SENTRY_DSN env)');
    return;
  }
  if (env.NODE_ENV !== 'production') {
    console.log(
      '[Sentry] init skipped (NODE_ENV is not production:',
      env.NODE_ENV + ')',
    );
    return;
  }

  Sentry.init({
    dsn,
    environment: env.NODE_ENV,

    // Release : permet de filtrer par version backend. A bumper a chaque
    // deploiement majeur (via process.env.GIT_SHA si dispo en CI).
    release: process.env.GIT_SHA ?? 'tolle-server@dev',

    // 100% des erreurs en prod (volume bas chez nous).
    sampleRate: 1.0,

    // Tracing : 10% des requetes HTTP, suffisant pour avoir des stats
    // de performance sans exploser le quota Sentry.
    tracesSampleRate: 0.1,

    // Anonymisation : on ne veut JAMAIS envoyer a Sentry :
    //   - Authorization header (JWT)
    //   - Body des routes /auth/* (peut contenir OTP, phone)
    //   - Body des routes /uploads (binaire enorme)
    beforeSend: (event) => {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.Authorization;
        delete event.request.headers.cookie;
      }
      const path = event.request?.url ?? '';
      if (
        path.includes('/auth/') ||
        path.includes('/uploads/') ||
        path.includes('/admin/login')
      ) {
        if (event.request) event.request.data = '[REDACTED]';
      }
      return event;
    },
  });

  console.log(
    '[Sentry] initialized',
    `env=${env.NODE_ENV}`,
    `release=${process.env.GIT_SHA ?? 'dev'}`,
  );
}

export { Sentry };
