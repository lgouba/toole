/**
 * Façade analytics Toolé (PostHog). Le RESTE de l'app n'importe JAMAIS PostHog
 * directement : il passe par `track` / `identifyUser` / `resetAnalytics`, ce qui
 * centralise le garde-fou PII (cf. analytics.events.ts), le gating dev et rend
 * l'outil remplaçable.
 *
 * - Prod/preview seulement (même politique que services/sentry.ts).
 * - Ne throw JAMAIS : l'observabilité ne doit ni casser ni bloquer l'app.
 * - distinct_id = user.id (UUID, pas une PII) ; seul `role` est envoyé en prop.
 */
import PostHog from 'posthog-react-native';
import Constants from 'expo-constants';
import {
  AnalyticsEvent,
  analyticsEnabled,
  sanitizeProps,
} from './analytics.events';

// Clé projet PostHog (publique, comme le DSN Sentry) + host Cloud EU.
// ⚠️ PLACEHOLDER : remplacer par la vraie clé `phc_...` fournie par le projet
// PostHog Cloud EU. Tant que c'est le placeholder, l'init est skippée (no-op).
const POSTHOG_KEY = 'phc_PLACEHOLDER';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

let posthog: PostHog | null = null;

export function initAnalytics(): void {
  const isDev = __DEV__;
  const isExpoGo = Constants.executionEnvironment === 'storeClient';

  if (!analyticsEnabled({ isDev, isExpoGo })) {
    console.log('[Analytics] init skipped (dev / Expo Go)');
    return;
  }
  if (!POSTHOG_KEY || POSTHOG_KEY === 'phc_PLACEHOLDER') {
    console.log('[Analytics] init skipped (clé PostHog absente)');
    return;
  }

  try {
    posthog = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      // Cycle de vie app (Application Opened/Backgrounded) → nourrit la courbe
      // de rétention sans instrumentation manuelle.
      captureAppLifecycleEvents: true,
      // Pas d'autocapture d'écran (noms d'écran = risque PII + bruit) : on reste
      // sur des events explicites et typés.
    });
    console.log('[Analytics] initialized');
  } catch (e) {
    console.log('[Analytics] init error', e);
    posthog = null;
  }
}

/** Associe les events suivants à l'utilisateur courant (UUID, pas de PII). */
export function identifyUser(user: { id: string; userType: string }): void {
  try {
    posthog?.identify(user.id, { role: user.userType });
  } catch {
    // no-op : l'analytics ne doit jamais casser l'app
  }
}

/** À appeler au logout : dissocie l'appareil de l'utilisateur. */
export function resetAnalytics(): void {
  try {
    posthog?.reset();
  } catch {
    // no-op
  }
}

/** Émet un event typé. Les props passent par le garde-fou PII avant envoi. */
export function track(
  event: AnalyticsEvent,
  props?: Record<string, unknown>,
): void {
  try {
    posthog?.capture(event, sanitizeProps(props));
  } catch {
    // no-op
  }
}
