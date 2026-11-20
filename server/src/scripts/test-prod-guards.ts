/**
 * Test jetable (tsx) des garde-fous de configuration production.
 * Run : cd server && npx tsx src/scripts/test-prod-guards.ts
 */
import assert from 'node:assert';
import {
  collectProdGuardErrors,
  isExampleSecret,
  MIN_JWT_SECRET_LENGTH,
  type ProdGuardInput,
} from '../config/prodGuards.js';

let passed = 0;
function check(label: string, cond: boolean) {
  assert.ok(cond, `ÉCHEC: ${label}`);
  passed++;
}

const STRONG = 'a'.repeat(MIN_JWT_SECRET_LENGTH); // exactement 32 → OK (borne basse acceptée)
const STRONGER = 'x'.repeat(48);

function base(overrides: Partial<ProdGuardInput> = {}): ProdGuardInput {
  return {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: STRONGER,
    JWT_REFRESH_SECRET: STRONGER,
    CORS_ORIGIN: 'https://admin-toole.qalitylabs.fr',
    ...overrides,
  };
}

// 1) Config prod saine → aucune erreur.
check('prod saine → 0 erreur', collectProdGuardErrors(base()).length === 0);

// 2) Hors production → jamais d'erreur, même avec une config pourrie.
for (const node of ['development', 'test']) {
  const errs = collectProdGuardErrors({
    NODE_ENV: node,
    JWT_ACCESS_SECRET: 'change-me',
    JWT_REFRESH_SECRET: 'x',
    CORS_ORIGIN: '*',
  });
  check(`NODE_ENV=${node} → 0 erreur (dev permissif)`, errs.length === 0);
}

// 3) Secret d'exemple en prod → erreur.
check(
  'JWT_ACCESS_SECRET=change-me en prod → erreur',
  collectProdGuardErrors(base({ JWT_ACCESS_SECRET: 'change-me-please-123456789012345' })).some((e) =>
    /example values/i.test(e),
  ),
);
check('isExampleSecret("changeMe")', isExampleSecret('changeMe'));
check('isExampleSecret("change-me")', isExampleSecret('change-me'));
check('isExampleSecret("s3cret-aléatoire") = false', !isExampleSecret('s3cret-aléatoire'));

// 4) Secret trop court en prod → erreur (le cœur du finding #3).
check(
  'JWT_ACCESS_SECRET 31c en prod → erreur longueur',
  collectProdGuardErrors(base({ JWT_ACCESS_SECRET: 'a'.repeat(31) })).some((e) =>
    /at least 32/i.test(e),
  ),
);
check(
  'JWT_REFRESH_SECRET 31c en prod → erreur longueur',
  collectProdGuardErrors(base({ JWT_REFRESH_SECRET: 'a'.repeat(31) })).some((e) =>
    /at least 32/i.test(e),
  ),
);
check('secret 32c pile → PAS d\'erreur longueur', collectProdGuardErrors(base({ JWT_ACCESS_SECRET: STRONG })).length === 0);

// 5) CORS_ORIGIN='*' en prod → erreur (finding #4).
check(
  "CORS_ORIGIN='*' en prod → erreur",
  collectProdGuardErrors(base({ CORS_ORIGIN: '*' })).some((e) => /CORS_ORIGIN/i.test(e)),
);
check(
  "CORS_ORIGIN origine explicite → PAS d'erreur CORS",
  !collectProdGuardErrors(base({ CORS_ORIGIN: 'https://admin-toole.qalitylabs.fr' })).some((e) =>
    /CORS_ORIGIN/i.test(e),
  ),
);
check(
  'CORS liste multi-origines → OK',
  collectProdGuardErrors(base({ CORS_ORIGIN: 'https://a.fr,https://b.fr' })).length === 0,
);

// 6) Plusieurs problèmes cumulés → plusieurs erreurs (toutes remontées, pas la 1re).
const multi = collectProdGuardErrors({
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'change-me',
  JWT_REFRESH_SECRET: 'short',
  CORS_ORIGIN: '*',
});
check('config pourrie en prod → ≥3 erreurs', multi.length >= 3);

console.log(`\n✅ ${passed} assertions OK — garde-fous prod (JWT ≥32c + CORS explicite) actifs.`);
