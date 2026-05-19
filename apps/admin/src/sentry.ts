import * as Sentry from '@sentry/react';

/**
 * Initialisation Sentry pour l'admin web Tollé.
 *
 * - DSN public : peut etre dans le code (juste l'URL d'envoi des erreurs).
 * - Skip en dev (Vite dev server) : on ne veut pas spam Sentry avec les
 *   erreurs locales.
 *
 * IMPORTANT : a appeler dans main.tsx AVANT le ReactDOM.createRoot.
 */
const DSN =
  'https://b9ae2b9ae229dedc24266e6316cfcae4@o4511418078461952.ingest.de.sentry.io/4511418148192336';

export function initSentry() {
  // Skip en dev / preview Vite : on ne send que depuis l'admin deploye en prod.
  if (import.meta.env.DEV) {
    console.log('[Sentry] init skipped (dev mode)');
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE ?? 'tolle-admin@dev',

    // 100% des erreurs en prod (volume bas).
    sampleRate: 1.0,

    // Tracing 10% des navigations / API calls
    tracesSampleRate: 0.1,

    // Integrations : BrowserTracing pour mesurer les performances + capture
    // automatique des navigations React Router.
    integrations: [Sentry.browserTracingIntegration()],

    // Anonymise les requetes avant envoi.
    beforeSend: (event) => {
      // Strip Authorization header
      if (event.request?.headers) {
        delete (event.request.headers as any).Authorization;
        delete (event.request.headers as any).authorization;
      }
      // Strip URL params sensibles
      if (event.request?.url) {
        event.request.url = event.request.url.replace(
          /([?&]token=)[^&]+/gi,
          '$1[REDACTED]',
        );
      }
      return event;
    },
  });

  console.log('[Sentry] initialized for admin web');
}

export { Sentry };
