/**
 * Test jetable (tsx) du schéma de validation de création de ticket support.
 * Run : cd server && npx tsx src/scripts/test-support-validation.ts
 */
import assert from 'node:assert';
import { createTicketSchema } from '../lib/supportValidation.js';

let passed = 0;
function check(label: string, cond: boolean) {
  assert.ok(cond, `ÉCHEC: ${label}`);
  passed++;
}

const ok = (data: unknown) => createTicketSchema.safeParse(data).success;

// Valide
check('payload minimal valide', ok({ category: 'other', description: 'Bonjour, un souci.' }));
check('avec deliveryId + photoUrl valides', ok({
  category: 'dispute',
  description: 'Colis abîmé',
  deliveryId: '11111111-1111-1111-1111-111111111111',
  photoUrl: '/uploads/reports/abc.jpg',
}));

// Invalide
check('catégorie hors enum → rejet', ok({ category: 'wat', description: 'xxxx' }) === false);
check('description vide → rejet', ok({ category: 'other', description: '' }) === false);
check('description espaces seuls → rejet', ok({ category: 'other', description: '   ' }) === false);
check('description > 2000 → rejet', ok({ category: 'other', description: 'x'.repeat(2001) }) === false);
check('deliveryId non-uuid → rejet', ok({ category: 'refund', description: 'remb', deliveryId: 'nope' }) === false);
check('photoUrl externe → rejet', ok({ category: 'dispute', description: 'x', photoUrl: 'https://evil.example/x.jpg' }) === false);

console.log(`\n✅ ${passed} assertions OK — createTicketSchema.`);
