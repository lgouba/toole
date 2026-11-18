/**
 * Test unitaire (fonction pure, sans DB) de extractAuthToken.
 * Usage : npx tsx src/scripts/test-extract-auth-token.ts
 *
 * Socle cookie admin (compat ascendante) : le middleware auth accepte le token
 * depuis le header `Authorization: Bearer ...` OU depuis un cookie HttpOnly.
 * Le HEADER reste prioritaire pour ne RIEN changer au fonctionnement actuel
 * (l'admin envoie encore le header). Le cookie n'est qu'un fallback.
 */
import {
  extractAuthToken,
  ACCESS_COOKIE_NAME,
  accessCookieOptions,
  durationToMs,
} from '../lib/authToken.js';

function assertEqual(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`ASSERT FAILED: ${msg}\n  attendu: ${e}\n  obtenu:  ${a}`);
}

const C = ACCESS_COOKIE_NAME;

// Header seul -> on prend le header
assertEqual(
  extractAuthToken('Bearer HEADERTOK', undefined),
  'HEADERTOK',
  'header seul => token du header',
);

// Cookie seul -> on prend le cookie
assertEqual(
  extractAuthToken(undefined, { [C]: 'COOKIETOK' }),
  'COOKIETOK',
  'cookie seul => token du cookie',
);

// Header ET cookie -> le header est PRIORITAIRE (compat : rien ne change)
assertEqual(
  extractAuthToken('Bearer HEADERTOK', { [C]: 'COOKIETOK' }),
  'HEADERTOK',
  'header + cookie => header prioritaire',
);

// Aucun des deux -> null
assertEqual(
  extractAuthToken(undefined, undefined),
  null,
  'ni header ni cookie => null',
);

// Header mal formé (pas "Bearer ") mais cookie présent -> fallback cookie
assertEqual(
  extractAuthToken('Token xyz', { [C]: 'COOKIETOK' }),
  'COOKIETOK',
  'header non-Bearer => fallback cookie',
);

// Header "Bearer " vide -> ne compte pas, fallback cookie
assertEqual(
  extractAuthToken('Bearer    ', { [C]: 'COOKIETOK' }),
  'COOKIETOK',
  'Bearer vide => fallback cookie',
);

// Header "Bearer " vide et pas de cookie -> null
assertEqual(
  extractAuthToken('Bearer ', {}),
  null,
  'Bearer vide + pas de cookie => null',
);

// Cookie d'un autre nom -> ignoré
assertEqual(
  extractAuthToken(undefined, { autre_cookie: 'X' }),
  null,
  'cookie au mauvais nom => null',
);

// --- accessCookieOptions : prod = Secure + SameSite=None ; dev = Lax, pas secure
assertEqual(
  accessCookieOptions(true, 900_000),
  { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 900_000 },
  'prod => Secure + SameSite=None',
);
assertEqual(
  accessCookieOptions(false),
  { httpOnly: true, secure: false, sameSite: 'lax', path: '/' },
  'dev => Lax, pas Secure, pas de maxAge si non fourni',
);

// --- durationToMs : formats courants + repli
assertEqual(durationToMs('15m', 1), 15 * 60 * 1000, '15m => 900000ms');
assertEqual(durationToMs('1h', 1), 3600 * 1000, '1h => 3600000ms');
assertEqual(durationToMs('30d', 1), 30 * 86400 * 1000, '30d => 30j en ms');
assertEqual(durationToMs('900', 1), 900 * 1000, '900 (secondes) => 900000ms');
assertEqual(durationToMs('garbage', 42), 42, 'format inconnu => fallback');

console.log('OK — extractAuthToken + cookie helpers : tous les cas passent');
