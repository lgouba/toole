/**
 * Test unitaire (fonction pure, sans DB) de classifyNoMatch.
 * Usage : npx tsx src/scripts/test-classify-no-match.ts
 *
 * classifyNoMatch décide, après le matching d'une course, s'il faut alerter
 * Sentry et POURQUOI aucun livreur n'a été notifié :
 *  - personne en ligne (attendu)            -> reason 'no_one_online'
 *  - des livreurs en ligne mais tous filtrés  -> reason 'online_but_filtered'
 *  - des livreurs proches mais tous occupés   -> reason 'all_busy'
 *  - au moins un livreur éligible             -> null (pas d'alerte)
 */
import { classifyNoMatch } from '../services/matching-diagnostics.js';

function assertEqual(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`ASSERT FAILED: ${msg}\n  attendu: ${e}\n  obtenu:  ${a}`);
}

// Aucun livreur proche + personne d'opérationnel en ligne -> attendu, mais on alerte groupé
assertEqual(
  classifyNoMatch({ nearbyCount: 0, onlineCount: 0, eligibleCount: 0 }),
  { report: true, reason: 'no_one_online' },
  'nearby=0 & online=0 => no_one_online',
);

// Aucun livreur proche MAIS des livreurs en ligne -> filtrés (position périmée / hors zone) : LE signal
assertEqual(
  classifyNoMatch({ nearbyCount: 0, onlineCount: 3, eligibleCount: 0 }),
  { report: true, reason: 'online_but_filtered' },
  'nearby=0 & online=3 => online_but_filtered',
);

// Des livreurs proches mais aucun éligible (tous occupés au-delà du seuil de chaînage)
assertEqual(
  classifyNoMatch({ nearbyCount: 5, onlineCount: 5, eligibleCount: 0 }),
  { report: true, reason: 'all_busy' },
  'nearby=5 & eligible=0 => all_busy',
);

// Au moins un livreur éligible -> match OK, aucune alerte
assertEqual(
  classifyNoMatch({ nearbyCount: 5, onlineCount: 5, eligibleCount: 2 }),
  null,
  'eligible=2 => null (pas d’alerte)',
);

// onlineCount est ignoré quand il y a des livreurs proches (cas all_busy insensible à online)
assertEqual(
  classifyNoMatch({ nearbyCount: 2, onlineCount: 0, eligibleCount: 0 }),
  { report: true, reason: 'all_busy' },
  'nearby>0 & eligible=0 => all_busy quel que soit online',
);

console.log('TEST_OK classifyNoMatch');
