/**
 * Garde-fous de configuration PRODUCTION, isolés ici pour être testables sans
 * importer `env.ts` (qui lit `process.env` et appelle `process.exit` au chargement).
 *
 * Contexte sécurité :
 * - Le payload JWT porte `userType`, cru par `requireRole('admin')`. Un secret
 *   JWT court/faible est bruteforçable → forge d'un token admin → compromission
 *   totale. En prod, un secret < 32 octets doit REFUSER le démarrage (pas juste
 *   un warn).
 * - `CORS_ORIGIN='*'` combiné à des requêtes authentifiées laisse n'importe quel
 *   site faire des appels credentials. En prod, on exige des origines explicites.
 *
 * `collectProdGuardErrors` ne décide pas de quitter : elle RETOURNE la liste des
 * erreurs fatales (vide = OK). C'est `env.ts` qui `process.exit(1)` si non vide.
 * Hors production, aucune erreur n'est levée (dev garde le défaut permissif).
 */
export interface ProdGuardInput {
  NODE_ENV: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CORS_ORIGIN: string;
}

/** Longueur minimale (en caractères) d'un secret JWT acceptée en production. */
export const MIN_JWT_SECRET_LENGTH = 32;

/** Vrai si la chaîne ressemble à un secret d'exemple ("change-me", "changeme"…). */
export function isExampleSecret(s: string): boolean {
  return /change-?me/i.test(s);
}

/**
 * Retourne la liste des erreurs de configuration fatales en production.
 * Vide hors production ou si la config est saine.
 */
export function collectProdGuardErrors(env: ProdGuardInput): string[] {
  if (env.NODE_ENV !== 'production') return [];

  const errors: string[] = [];

  if (isExampleSecret(env.JWT_ACCESS_SECRET) || isExampleSecret(env.JWT_REFRESH_SECRET)) {
    errors.push(
      'JWT secrets are still the example values ("change-me…"). Set strong random secrets (JWT_ACCESS_SECRET / JWT_REFRESH_SECRET).',
    );
  }

  if (
    env.JWT_ACCESS_SECRET.length < MIN_JWT_SECRET_LENGTH ||
    env.JWT_REFRESH_SECRET.length < MIN_JWT_SECRET_LENGTH
  ) {
    errors.push(
      `JWT secrets must be at least ${MIN_JWT_SECRET_LENGTH} chars in production (bruteforçable secret = forged admin token). Use long random secrets.`,
    );
  }

  if (env.CORS_ORIGIN === '*') {
    errors.push(
      'CORS_ORIGIN="*" in production reflète n\'importe quelle origine avec credentials. Définir les origines explicites (ex. https://admin-toole.qalitylabs.fr).',
    );
  }

  return errors;
}
