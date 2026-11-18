/**
 * Logique PURE de l'analytics Toolé (sans PostHog, React ni expo) → testable en
 * tsx. La façade `services/analytics.ts` importe ces helpers ; le reste de l'app
 * n'importe jamais PostHog directement.
 */

/**
 * Events produit, volontairement restreints et orientés rétention/activation.
 * Union fermée : aucune string libre au call-site (le typage l'empêche).
 */
export type AnalyticsEvent =
  | 'signup_completed'
  | 'login_completed'
  | 'delivery_estimated'
  | 'delivery_created'
  | 'delivery_cancelled'
  | 'delivery_completed'
  | 'driver_online'
  | 'driver_offline'
  | 'delivery_accepted'
  | 'delivery_delivered';

/**
 * Liste BLANCHE des propriétés autorisées sur un event. Garde-fou anti-PII :
 * toute clé absente d'ici est droppée, même si un appelant la passe. On n'y met
 * JAMAIS de champ pouvant contenir une PII (nom, téléphone, email, OTP, token).
 * - role        : 'client' | 'livreur' (userType)
 * - delivery_id : UUID d'une course (pas une PII)
 * - distance_m  : distance estimée en mètres
 * - price       : montant estimé
 * - by          : 'client' | 'driver' (auteur d'une annulation)
 */
export const ALLOWED_PROP_KEYS = [
  'role',
  'delivery_id',
  'distance_m',
  'price',
  'by',
] as const;

/**
 * Ne conserve que les clés de la liste blanche dont la valeur est primitive
 * (string | number). Rend `undefined` si rien ne reste (PostHog accepte un
 * capture sans props).
 */
export function sanitizeProps(
  raw: Record<string, unknown> | undefined,
): Record<string, string | number> | undefined {
  if (!raw) return undefined;
  const out: Record<string, string | number> = {};
  for (const key of ALLOWED_PROP_KEYS) {
    const value = raw[key];
    if (typeof value === 'string' || typeof value === 'number') {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Analytics activée uniquement hors dev / Expo Go (même politique que Sentry :
 * on ne pollue pas les dashboards avec le développement, et on ne fausse pas la
 * courbe de rétention).
 */
export function analyticsEnabled(input: {
  isDev: boolean;
  isExpoGo: boolean;
}): boolean {
  return !input.isDev && !input.isExpoGo;
}
