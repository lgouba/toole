/**
 * Test jetable (tsx) du générateur de référence de ticket support.
 * Run : cd server && npx tsx src/scripts/test-support-reference.ts
 */
import assert from 'node:assert';
import { generateSupportReference } from '../lib/supportReference.js';

let passed = 0;
function check(label: string, cond: boolean) {
  assert.ok(cond, `ÉCHEC: ${label}`);
  passed++;
}

// 1) Format : SUP- + 6 caractères base36 majuscules.
const re = /^SUP-[A-Z0-9]{6}$/;
for (let i = 0; i < 100; i++) {
  check('format SUP-XXXXXX', re.test(generateSupportReference()));
}

// 2) Unicité raisonnable : 2000 tirages, quasi aucun doublon.
const seen = new Set<string>();
let dupes = 0;
for (let i = 0; i < 2000; i++) {
  const ref = generateSupportReference();
  if (seen.has(ref)) dupes++;
  seen.add(ref);
}
check(`unicité (doublons=${dupes} sur 2000, toléré <5)`, dupes < 5);

console.log(`\n✅ ${passed} assertions OK — generateSupportReference.`);
