/**
 * Test jetable (tsx) du mapping type→catégorie + décision d'envoi.
 * Run : cd server && npx tsx src/scripts/test-notification-category.ts
 */
import assert from 'node:assert';
import {
  categoryForType,
  isPushAllowed,
  type NotifPrefs,
} from '../lib/notificationCategory.js';

let passed = 0;
function check(label: string, cond: boolean) {
  assert.ok(cond, `ÉCHEC: ${label}`);
  passed++;
}

// 1) Mapping type → catégorie.
check('new_request → newDeliveries', categoryForType('new_request') === 'newDeliveries');
check('delivery_delivered → deliveryUpdates', categoryForType('delivery_delivered') === 'deliveryUpdates');
check('message (chat) → deliveryUpdates', categoryForType('message') === 'deliveryUpdates');
check('broadcast → promotions', categoryForType('broadcast') === 'promotions');
check('withdrawal → always', categoryForType('withdrawal') === 'always');
check('commission → always', categoryForType('commission') === 'always');
check('type inconnu → always', categoryForType('wat') === 'always');
check('type absent → always', categoryForType(undefined) === 'always');

const ALL_ON: NotifPrefs = {
  notifNewDeliveries: true,
  notifDeliveryUpdates: true,
  notifPromotions: true,
};

// 2) Tout activé → tout passe.
check('tout ON: new_request passe', isPushAllowed('new_request', ALL_ON));
check('tout ON: broadcast passe', isPushAllowed('broadcast', ALL_ON));

// 3) Promotions coupées → broadcast bloqué, le reste passe.
const noPromo: NotifPrefs = { ...ALL_ON, notifPromotions: false };
check('promo OFF: broadcast bloqué', isPushAllowed('broadcast', noPromo) === false);
check('promo OFF: new_request passe', isPushAllowed('new_request', noPromo) === true);
check('promo OFF: withdrawal passe (always)', isPushAllowed('withdrawal', noPromo) === true);

// 4) Nouvelles courses coupées → new_request bloqué.
check('newDeliveries OFF: new_request bloqué', isPushAllowed('new_request', { ...ALL_ON, notifNewDeliveries: false }) === false);

// 5) Suivi coupé → delivery_* et message bloqués, mais compte toujours OK.
const noUpdates: NotifPrefs = { ...ALL_ON, notifDeliveryUpdates: false };
check('suivi OFF: delivery_accepted bloqué', isPushAllowed('delivery_accepted', noUpdates) === false);
check('suivi OFF: message bloqué', isPushAllowed('message', noUpdates) === false);
check('suivi OFF: account_activated passe (always)', isPushAllowed('account_activated', noUpdates) === true);

// 6) Défaut PERMISSIF : prefs absentes → on envoie.
check('prefs null → broadcast passe', isPushAllowed('broadcast', null) === true);
check('prefs undefined → new_request passe', isPushAllowed('new_request', undefined) === true);
// Champ indéfini (migration pas encore hydratée) → traité comme autorisé.
check('champ indéfini → passe', isPushAllowed('broadcast', {}) === true);

console.log(`\n✅ ${passed} assertions OK — filtrage push par catégorie (always jamais coupé).`);
