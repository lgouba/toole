/**
 * Test jetable (tsx) du libellé d'état de localisation.
 * Run : cd apps/mobile && npx tsx utils/locationPermissionLabel.test.ts
 */
import assert from 'node:assert';
import { describeLocationPermission } from './locationPermissionLabel.js';

let passed = 0;
function check(label: string, cond: boolean) {
  assert.ok(cond, `ÉCHEC: ${label}`);
  passed++;
}

// 1) Background accordé → en continu, OK, pas d'alerte.
const bg = describeLocationPermission({ foregroundGranted: true, backgroundGranted: true });
check('background → "Activée en continu"', bg.label === 'Activée en continu');
check('background → tone ok', bg.tone === 'ok');
check('background → pas d\'alerte', bg.needsAttention === false);

// 2) Foreground seul → à l'usage, warn, alerte (bug GPS figé en fond).
const fg = describeLocationPermission({ foregroundGranted: true, backgroundGranted: false });
check('foreground seul → ton warn', fg.tone === 'warn');
check('foreground seul → needsAttention', fg.needsAttention === true);
check('foreground seul → mentionne "usage"', /usage/i.test(fg.label));

// 3) Rien accordé → désactivée, bad, alerte.
const none = describeLocationPermission({ foregroundGranted: false, backgroundGranted: false });
check('aucune → "Désactivée"', none.label === 'Désactivée');
check('aucune → ton bad', none.tone === 'bad');
check('aucune → needsAttention', none.needsAttention === true);

// 4) Cas incohérent (background sans foreground) → traité comme background OK
//    (l'OS ne renvoie pas ce cas, mais la fonction ne doit pas planter).
const weird = describeLocationPermission({ foregroundGranted: false, backgroundGranted: true });
check('background sans foreground → ok (robuste)', weird.tone === 'ok');

console.log(`\n✅ ${passed} assertions OK — libellé localisation (livreur) correct.`);
