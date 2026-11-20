/**
 * Test jetable (tsx) de la garde d'accès aux uploads KYC.
 *
 * Régression visée : la garde KYC montée en préfixe (`/uploads/kyc`) était
 * sautée par des formes d'URL (`//kyc`, `kyc%2f`, `./kyc`) que `express.static`
 * résolvait quand même vers le fichier KYC → fuite non authentifiée des pièces
 * d'identité, TTL/signature contournés.
 *
 * Run :
 *   cd server && DATABASE_URL=x JWT_ACCESS_SECRET=test-secret-32-characters-long-xx \
 *     JWT_REFRESH_SECRET=test-refresh-secret-32-characters-xx \
 *     npx tsx src/scripts/test-kyc-upload-guard.ts
 */
import assert from 'node:assert';
import {
  isUploadAccessAllowed,
  normalizeServedUploadPath,
  signKycUrl,
} from '../lib/signedUpload.js';

let passed = 0;
function check(label: string, cond: boolean) {
  assert.ok(cond, `ÉCHEC: ${label}`);
  passed++;
}

// --- normalizeServedUploadPath : toutes les formes résolvent au canonique ---
const CANON = '/uploads/kyc/secret.jpg';
check('canonique inchangé', normalizeServedUploadPath(CANON) === CANON);
check('double slash effondré', normalizeServedUploadPath('/uploads//kyc/secret.jpg') === CANON);
check('triple slash effondré', normalizeServedUploadPath('/uploads///kyc/secret.jpg') === CANON);
check('slash encodé %2f décodé', normalizeServedUploadPath('/uploads/kyc%2Fsecret.jpg') === CANON);
check('préfixe entier encodé', normalizeServedUploadPath('/uploads%2Fkyc%2Fsecret.jpg') === CANON);
check('segment . résolu', normalizeServedUploadPath('/uploads/./kyc/secret.jpg') === CANON);
check('détour .. résolu', normalizeServedUploadPath('/uploads/kyc/../kyc/secret.jpg') === CANON);
check('query ignorée', normalizeServedUploadPath('/uploads//kyc/secret.jpg?exp=1&sig=2') === CANON);

// --- isUploadAccessAllowed : KYC sans signature = REFUSÉ quelle que soit la forme ---
const bypassForms = [
  '/uploads/kyc/secret.jpg', // canonique nu
  '/uploads//kyc/secret.jpg', // double slash (ancien bypass)
  '/uploads/kyc%2Fsecret.jpg', // slash encodé (ancien bypass)
  '/uploads%2Fkyc%2Fsecret.jpg', // préfixe encodé
  '/uploads/./kyc/secret.jpg', // segment .
  '/uploads/kyc/../kyc/secret.jpg', // détour ..
];
for (const form of bypassForms) {
  check(`KYC sans sig refusé: ${form}`, isUploadAccessAllowed(form, undefined, undefined) === false);
}

// --- KYC avec signature VALIDE = autorisé, y compris via une forme exotique ---
const signed = signKycUrl(CANON)!; // "/uploads/kyc/secret.jpg?exp=…&sig=…"
const qi = signed.indexOf('?');
const sp = new URLSearchParams(signed.slice(qi + 1));
const exp = sp.get('exp')!;
const sig = sp.get('sig')!;
check('canonique + sig valide autorisé', isUploadAccessAllowed(CANON, exp, sig) === true);
check(
  'forme exotique + sig valide autorisé (sig lie le chemin canonique)',
  isUploadAccessAllowed('/uploads//kyc/secret.jpg', exp, sig) === true,
);

// --- Signatures invalides / rejouées = refusé ---
check('sig falsifiée refusée', isUploadAccessAllowed(CANON, exp, 'deadbeef'.repeat(4)) === false);
check('exp expirée refusée', isUploadAccessAllowed(CANON, String(Date.now() - 1000), sig) === false);
// Signature valide d'un AUTRE fichier ne doit pas ouvrir celui-ci.
const signedOther = signKycUrl('/uploads/kyc/other.jpg')!;
const spO = new URLSearchParams(signedOther.slice(signedOther.indexOf('?') + 1));
check(
  'sig d\'un autre fichier refusée',
  isUploadAccessAllowed(CANON, spO.get('exp')!, spO.get('sig')!) === false,
);

// --- Fichiers publics (avatars/packages) servis sans signature ---
check('avatar public sans sig autorisé', isUploadAccessAllowed('/uploads/avatars/a.jpg') === true);
check('package public sans sig autorisé', isUploadAccessAllowed('/uploads/packages/p.jpg') === true);
check(
  'avatar via double slash autorisé',
  isUploadAccessAllowed('/uploads//avatars/a.jpg') === true,
);
// Un chemin qui tente de se faire passer pour kyc mais ne l'est pas après normalisation.
check(
  'faux-ami "kycX" non protégé (pas sous kyc/)',
  isUploadAccessAllowed('/uploads/kycX/a.jpg') === true,
);

console.log(`\n✅ ${passed} assertions OK — garde upload KYC robuste aux contournements de chemin.`);
