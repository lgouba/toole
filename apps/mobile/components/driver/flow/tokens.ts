import { Platform } from 'react-native';
import { fontFamily } from '@/theme';

/**
 * Tokens du parcours livreur « Hero coloré » (modèle C). Palette + polices
 * locales à ce flux, alignées sur la maquette `toole_modele_C_sans_carte.html`.
 *
 * ⚠️ Polices : on n'utilise QUE des familles déjà embarquées dans le build
 * (Inter / Bricolage / monospace système) — surtout pas Archivo/Space Grotesk
 * non installées, qui casseraient l'OTA (téléchargement bloquant au splash).
 *   • Archivo (UI)        → Inter (tokens thème)
 *   • Space Grotesk (chiffres/code) → Bricolage Grotesque
 *   • Space Mono (étape n/4)        → monospace système
 */
export const C = {
  ink: '#16140F',
  muted: '#8d8a82',
  hair: '#ECE8DF',
  paper: '#FFFDF7',
  white: '#FFFFFF',

  gDark: '#15803D',
  gMid: '#16A34A',
  gBright: '#22C55E',
  lime: '#86EFAC',

  amber: '#E8870A',
  amberText: '#FFB454',
  amberSoft: '#FFD9A6',

  // Dégradé du hood (linear-gradient 165deg de la maquette)
  gradFrom: '#0c3d20',
  gradMid: '#12642f',
  gradTo: '#16A34A',

  // Pavé sombre « Annuler la course »
  dark: '#1c1410',
} as const;

export const F = {
  ui: fontFamily.regular,
  uiMed: fontFamily.medium,
  uiSemi: fontFamily.semiBold,
  uiBold: fontFamily.bold,
  display: 'BricolageGrotesque_700Bold',
  displayX: 'BricolageGrotesque_800ExtraBold',
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;
