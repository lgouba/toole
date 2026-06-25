import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Initialisation Sentry pour Toolé Mobile.
 *
 * Appele AU TOUT DEBUT de l'app (dans _layout.tsx, avant tout le reste).
 *
 * - DSN public : peut etre dans le code, c'est juste l'URL d'envoi.
 * - Skip en dev / Expo Go : on ne veut pas spam Sentry avec les crashs de dev.
 * - Release tag avec version + updateId : permet de filtrer les crashs par
 *   bundle (utile pour savoir si une OTA recente a casse l'app).
 */
const DSN =
  'https://7772e71db9dd0adbbfbf89f53f065a0c@o4511418078461952.ingest.de.sentry.io/4511418088489040';

export function initSentry() {
  // Detecte le mode dev : on n'envoie PAS de crashs en developpement (Expo Go,
  // Metro local, etc.). Sentry est reserve aux builds prod / preview installes.
  const isDev =
    __DEV__ || Constants.executionEnvironment === 'storeClient';

  if (isDev) {
    console.log('[Sentry] init skipped (dev mode)');
    return;
  }

  // Version de l'app installee + id du bundle JS courant (change a chaque
  // OTA). Permet a Sentry de grouper les crashs par release et de pinpointer
  // quelle OTA a introduit un bug.
  const appVersion =
    Constants.expoConfig?.version ??
    (Constants.manifest as any)?.version ??
    '0.0.0';

  let updateId = 'embedded';
  let channel = 'unknown';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates') as typeof import('expo-updates');
    updateId = Updates.updateId ?? 'embedded';
    channel = Updates.channel ?? 'unknown';
  } catch {
    // expo-updates non dispo, on continue
  }

  Sentry.init({
    dsn: DSN,

    // Format du release : "toole-mobile@1.0.0+OTA_ID"
    // -> tu peux filtrer dans Sentry par "release:toole-mobile@1.0.0+abc123"
    //    pour ne voir QUE les crashs apres une OTA precise.
    release: `toole-mobile@${appVersion}+${updateId.slice(0, 8)}`,

    // Environnement : preview / production / dev
    environment: channel,

    // 100% des erreurs capturees en prod (volume bas chez nous, pas besoin de sampler).
    // Si le volume devient gros plus tard, descendre a 0.5 ou 0.1.
    sampleRate: 1.0,

    // Tracing : capture les performances (HTTP, navigation) sur 20% des sessions.
    // 1.0 serait trop verbeux et consumerait le quota gratuit Sentry trop vite.
    tracesSampleRate: 0.2,

    // Ne pas envoyer les requetes axios dont l'URL contient "uploads/" (PHOTOS
    // de colis / KYC) : les URL avec UUID polluent le dashboard sans valeur.
    beforeSendTransaction: (event) => {
      if (event.request?.url?.includes('/uploads/')) return null;
      return event;
    },

    // Erreurs RN benignes a ignorer (gerees automatiquement par le runtime,
    // mais qui polluent le dashboard Sentry et faussent le taux de crash).
    ignoreErrors: [
      // Fabric / New Architecture : se produit quand une view est unmount
      // pendant une mise a jour de layout. Le runtime retry l'operation
      // (d'ou "Retryable") et l'app ne crash pas reellement.
      'RetryableMountingLayerException',
      'Unable to find viewState for tag',
      // Erreur reseau classique quand l'utilisateur perd la connexion.
      // Deja gere par l'UI (banner offline + retry), pas la peine d'alerter.
      'Network request failed',
    ],

    // Anonymise les donnees sensibles avant envoi.
    beforeSend: (event) => {
      // Ne JAMAIS envoyer les tokens auth ni le code OTP en clair dans les
      // breadcrumbs ou request bodies.
      if (event.request?.headers) {
        delete (event.request.headers as any).Authorization;
        delete (event.request.headers as any).authorization;
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => {
          if (b.data?.url?.includes('/auth/')) {
            // On garde l'URL pour debug mais on retire le body (peut contenir OTP)
            const { data, ...rest } = b;
            const { request_body_size: _, ...safeData } = data as any;
            return { ...rest, data: { ...safeData, body: '[REDACTED]' } };
          }
          return b;
        });
      }
      return event;
    },
  });

  console.log(
    '[Sentry] initialized',
    `release=toole-mobile@${appVersion}+${updateId.slice(0, 8)}`,
    `env=${channel}`,
  );
}

// Re-export pour permettre `import { Sentry } from '@/services/sentry'`
// dans le reste du code (pour appeler Sentry.captureException, etc.)
export { Sentry };
