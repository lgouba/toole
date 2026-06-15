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

/** Tokens dédiés à l'étape 1 (taille + catégorie). Cohérents crème + vert. */
export const step1 = {
  canvas: '#F5F2EC',
  surface: '#FFFFFF',
  border: '#EBE3D3',
  textPrim: '#1A1A17',
  textSec: '#6B6356',
  textMuted: '#8A8270',
  green: '#15803D',
  greenMid: '#16A34A',
  stageBg: '#ECF1E8',
  stageTint: 'rgba(22,163,74,0.10)',
  radius: { stage: 26, tile: 18, card: 16, field: 14 },
  parcel: {
    top: '#E6C699',
    front: '#CFA168',
    side: '#B5854F',
    tape: '#1E9E50',
    tapeTop: '#15A150',
  },
  // Clés alignées sur PackageSize du repo ('small'|'medium'|'large').
  sizes: [
    { key: 'small', name: 'Petit', weight: 'moins de 5 kg', scale: 0.58 },
    { key: 'medium', name: 'Moyen', weight: '5 – 20 kg · standard', scale: 0.9 },
    { key: 'large', name: 'Grand', weight: 'plus de 20 kg', scale: 1.24 },
  ] as const,
} as const;
