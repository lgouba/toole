/**
 * Test unitaire (fonction pure, sans PostHog ni React) de la logique analytics.
 * Usage : npx tsx services/analytics.events.test.ts
 *
 * - sanitizeProps : garde-fou PII. Ne laisse passer QUE les clés de la liste
 *   blanche avec une valeur primitive (string|number). Tout le reste est DROP.
 * - analyticsEnabled : no-op en dev / Expo Go (comme Sentry).
 */
import { sanitizeProps, analyticsEnabled } from './analytics.events.js';

function assertEqual(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`ASSERT FAILED: ${msg}\n  attendu: ${e}\n  obtenu:  ${a}`);
}

// Toutes les clés autorisées, valeurs primitives -> conservées
assertEqual(
  sanitizeProps({ role: 'client', delivery_id: 'uuid-1', distance_m: 1200, price: 500 }),
  { role: 'client', delivery_id: 'uuid-1', distance_m: 1200, price: 500 },
  'clés autorisées + primitives => conservées',
);

// PII mélangée -> seules les clés autorisées restent
assertEqual(
  sanitizeProps({ role: 'client', name: 'Issa', phone: '+226700000', token: 'x', otp: '1234' }),
  { role: 'client' },
  'PII (name/phone/token/otp) droppée, role conservé',
);

// 'by' autorisé
assertEqual(
  sanitizeProps({ by: 'driver' }),
  { by: 'driver' },
  'by autorisé',
);

// Clé hors liste blanche seule -> undefined
assertEqual(
  sanitizeProps({ foo: 'bar' }),
  undefined,
  'clé hors liste => undefined',
);

// Valeur non primitive sur clé autorisée -> droppée (=> undefined si rien d'autre)
assertEqual(
  sanitizeProps({ delivery_id: { nested: 1 } as unknown as string }),
  undefined,
  'valeur non primitive sur clé autorisée => droppée',
);

// undefined en entrée -> undefined
assertEqual(sanitizeProps(undefined), undefined, 'undefined => undefined');

// Objet vide -> undefined
assertEqual(sanitizeProps({}), undefined, 'objet vide => undefined');

// --- analyticsEnabled : dev / Expo Go => désactivé
assertEqual(analyticsEnabled({ isDev: true, isExpoGo: false }), false, 'dev => off');
assertEqual(analyticsEnabled({ isDev: false, isExpoGo: true }), false, 'Expo Go => off');
assertEqual(analyticsEnabled({ isDev: false, isExpoGo: false }), true, 'prod/preview => on');

console.log('OK — analytics.events : sanitizeProps + analyticsEnabled, tous les cas passent');
