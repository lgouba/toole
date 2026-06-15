import { Platform } from 'react-native';

/**
 * Tokens dédiés à l'écran "Récapitulatif" (direction billet / itinéraire).
 *
 * Adapté au repo Toolé :
 *  - L'accent vert (#15803D) correspond déjà à `colors.secondary` (vert kola).
 *  - Police "mono" = monospace natif (Menlo iOS / monospace Android) → AUCUNE
 *    dépendance ajoutée, compatible OTA (pas de rebuild). display/body =
 *    polices de marque déjà chargées (_layout.tsx).
 *
 * Divergence assumée vs le thème global terra-cotta : cet écran a sa propre
 * direction "billet" (canvas crème + accent vert), voulue par le design.
 */

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!;

export const recap = {
  color: {
    canvas: '#FBF8F1',
    surface: '#FFFFFF',
    border: '#EEE6D6',
    hairline: '#F0EAD9',
    dashed: '#CFC8B6',
    textPrimary: '#1A1A17',
    textSecond: '#6F6A5D',
    textMuted: '#A59E8C',
    textMuted2: '#9A9485',
    green: '#15803D',
    greenMid: '#16A34A',
    greenBright: '#22C55E',
    greenTintBg: '#F3F7EE',
    greenTintBd: '#D9E7C9',
    dotPickup: '#16A34A',
    dotDropoff: '#1A1A17',
    ink: '#1A1A17',
  },
  radius: { card: 24, tile: 16, field: 13, pill: 999 },
  space: { xs: 6, sm: 8, md: 10, lg: 12, xl: 14, xxl: 16, gut: 18, pad: 22 },
  font: {
    display: 'BricolageGrotesque_700Bold',
    displayXBold: 'BricolageGrotesque_800ExtraBold',
    body: 'PlusJakartaSans_500Medium',
    bodyBold: 'PlusJakartaSans_700Bold',
    mono: MONO,
  },
  shadow: {
    card: {
      shadowColor: '#503C0A',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 4,
    },
    confirm: {
      shadowColor: '#15803D',
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
  },
} as const;

/** Fuseau opérationnel (Ouagadougou = UTC+0, sans DST). */
export const APP_TIMEZONE = 'Africa/Ouagadougou';
