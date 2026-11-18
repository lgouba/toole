/**
 * Test unitaire (fonctions pures, sans RN) de la décision de reload couleur.
 * Usage : npx tsx theme/colorReload.test.ts
 */
import { shouldReloadForColors, isSafeToReload } from './colorReload';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

// --- shouldReloadForColors ---
// Pas de baseline encore fixée (avant hydratation) -> jamais de reload (évite la boucle de boot)
assert(
  shouldReloadForColors(null, { primary: '#111', secondary: '#222' }) === false,
  'baseline null => pas de reload',
);
// Baseline identique -> pas de reload
assert(
  shouldReloadForColors({ primary: '#111', secondary: '#222' }, { primary: '#111', secondary: '#222' }) === false,
  'couleurs identiques => pas de reload',
);
// Primary change -> reload
assert(
  shouldReloadForColors({ primary: '#111', secondary: '#222' }, { primary: '#999', secondary: '#222' }) === true,
  'primary change => reload',
);
// Secondary change -> reload
assert(
  shouldReloadForColors({ primary: '#111', secondary: '#222' }, { primary: '#111', secondary: '#999' }) === true,
  'secondary change => reload',
);

// --- isSafeToReload ---
assert(
  isSafeToReload({ appActive: true, hasActiveDelivery: false }) === true,
  'premier plan + pas de course => sûr',
);
assert(
  isSafeToReload({ appActive: false, hasActiveDelivery: false }) === false,
  'arrière-plan => pas sûr',
);
assert(
  isSafeToReload({ appActive: true, hasActiveDelivery: true }) === false,
  'course active => pas sûr',
);

console.log('TEST_OK colorReload');
