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

/** Tokens dédiés à l'étape 2 (trajet / adresses). Même famille crème + vert. */
export const step2 = {
  canvas: '#F5F2EC',
  surface: '#FFFFFF',
  border: '#EBE3D3',
  textPrim: '#1A1A17',
  textSec: '#6B6356',
  textMuted: '#8A8270',
  green: '#15803D',
  greenMid: '#16A34A',
  dotPickup: '#16A34A',
  dotDropoff: '#1A1A17',
  activeRing: '#16A34A',
  activeBg: '#F4FAF0',
  summaryBg: '#1A1A17',
  linkBg: '#FBF6E9',
  linkBorder: '#EFE3C4',
  radius: { card: 20, row: 15, tile: 16, field: 15, pill: 999, summary: 18 },
} as const;

/** Tokens dédiés à l'étape 3 (destinataire). Même famille crème + vert. */
export const step3 = {
  canvas: '#F5F2EC',
  surface: '#FFFFFF',
  border: '#EBE3D3',
  textPrim: '#1A1A17',
  textSec: '#6B6356',
  textMuted: '#A59E8C',
  green: '#15803D',
  greenMid: '#16A34A',
  avatarRecipient: { bg: '#E7F2E9', fg: '#15803D' },
  avatarHolder: { bg: '#FBEFD6', fg: '#C5961A' },
  contactsBtn: { bg: '#F3F9EF', border: '#CFE6C7', fg: '#15803D' },
  fieldBg: '#FBF9F4',
  fieldFocus: '#16A34A',
  toggleIdle: { bg: '#FBF6E9', border: '#EFE3C4', fg: '#C5961A' },
  toggleActive: { bg: '#F3F9EF', border: '#16A34A', fg: '#15803D' },
  radius: { card: 20, field: 13, toggle: 18, avatar: 14, pill: 999 },
} as const;

/** Tokens dédiés à l'accueil client (carte + onboarding). */
export const home = {
  canvas: '#F5F2EC',
  surface: '#FFFFFF',
  border: '#EBE3D3',
  textPrim: '#1A1A17',
  textSec: '#6B6356',
  textMuted: '#8A8270',
  green: '#15803D',
  greenMid: '#16A34A',
  greenTint: '#E7F2E9',
  courierOnline: '#15803D',
  courierOffline: '#AEB2AB',
  radius: { card: 18, sheet: 26, marker: 999 },
} as const;

/** Tokens dédiés à l'écran Profil (client). */
export const profile = {
  canvas: '#F5F2EC',
  surface: '#FFFFFF',
  border: '#EBE3D3',
  divider: '#F0EAD9',
  textPrim: '#1A1A17',
  textSec: '#6B6356',
  textMuted: '#8A8270',
  green: '#15803D',
  avatarBg: '#E7F2E9',
  avatarFg: '#15803D',
  star: '#E0A21C',
  danger: '#D6453C',
  dangerBorder: '#F0D9D6',
  tint: {
    green: '#E7F2E9',
    blue: '#E0EEFB',
    amber: '#FBEFD6',
    violet: '#EFE7FB',
    neutral: '#F1F0EA',
  },
  chip: {
    ok: { bg: '#EEF2EB', fg: '#5E7A52' },
    todo: { bg: '#FBF3DC', fg: '#B5710C' },
    neutral: { bg: '#F1F0EA', fg: '#8A8270' },
  },
  radius: { card: 18, row: 11, avatar: 999 },
} as const;

/** Tokens dédiés à l'écran "Mes envois". */
export const shipments = {
  canvas: '#F5F2EC',
  surface: '#FFFFFF',
  border: '#EBE3D3',
  divider: '#F0EAD9',
  textPrim: '#1A1A17',
  textSec: '#6B6356',
  textMuted: '#A59E8C',
  green: '#15803D',
  routeDot: '#15803D',
  routeSquare: '#16132E',
  dash: '#D8D1C0',
  liveBg: '#F1F8EE',
  liveBorder: '#DCEBD5',
  chipBorder: '#E4DBC9',
  radius: { card: 18, chip: 999, badge: 999 },
} as const;

/** Statut UI (bucket) → couleurs accent + badge. */
export const shipmentStatus = {
  en_cours: { accent: '#16A34A', badgeBg: '#E7F2E9', badgeFg: '#15803D', label: 'En cours' },
  livree: { accent: '#C7D2C0', badgeBg: '#EEF2EB', badgeFg: '#5E7A52', label: 'Livrée' },
  annulee: { accent: '#E7A39C', badgeBg: '#FBE9E7', badgeFg: '#D6453C', label: 'Annulée' },
} as const;

export type ShipmentBucket = keyof typeof shipmentStatus;

/** Tokens dédiés à l'accueil LIVREUR (cockpit, thème clair). */
export const driverHome = {
  canvas: '#F5F2EC',
  surface: '#FFFFFF',
  border: '#EBE3D3',
  divider: '#F0EAD9',
  textPrim: '#1A1A17',
  textSec: '#6B6356',
  textMuted: '#A59E8C',
  green: '#15803D',
  greenMid: '#16A34A',
  greenBright: '#22C55E',
  halo: 'rgba(22,163,74,0.22)',
  ping: 'rgba(21,128,61,0.42)',
  offGrey: '#C9C6BD',
  radius: { dial: 999, card: 16 },
} as const;

/** Tokens dédiés à "Mes livraisons" (livreur). */
export const deliveries = {
  canvas: '#F5F2EC',
  surface: '#FFFFFF',
  border: '#EBE3D3',
  divider: '#F0EAD9',
  textPrim: '#1A1A17',
  textSec: '#6B6356',
  textMuted: '#A59E8C',
  green: '#15803D',
  dep: '#15803D',
  arr: '#16132E',
  liveBg: '#F1F8EE',
  liveBorder: '#DCEBD5',
  chipBorder: '#E4DBC9',
  status: {
    en_cours: { accent: '#15803D', badgeBg: '#EAF3EC', badgeFg: '#15803D', label: 'En cours' },
    livree: { accent: '#5E7A52', badgeBg: '#EEF2EB', badgeFg: '#5E7A52', label: 'Terminée' },
    annulee: { accent: '#D6453C', badgeBg: '#FBE9E7', badgeFg: '#D6453C', label: 'Annulée' },
  },
  radius: { card: 18, pill: 999, btn: 12 },
} as const;

/** Tokens dédiés au Portefeuille livreur (carte Toolé). */
export const wallet = {
  canvas: '#F5F2EC',
  surface: '#FFFFFF',
  border: '#EBE3D3',
  divider: '#F0EAD9',
  textPrim: '#1A1A17',
  textSec: '#6B6356',
  textMuted: '#A59E8C',
  green: '#15803D',
  cardGradFrom: '#1F9A4C',
  cardGradTo: '#0E5E2A',
  amberBg: '#FBF3DC',
  amberBorder: '#EFD9A2',
  amberFg: '#B5710C',
  amberDot: '#E0A21C',
  plus: '#15803D',
  minus: '#B5710C',
  orange: '#F47A20',
  moov: '#1E5BD6',
  radius: { card: 22, btn: 14, row: 14 },
} as const;

/** Tokens dédiés à l'étape 4 (paiement). Même famille crème + vert. */
export const step4 = {
  canvas: '#F5F2EC',
  surface: '#FFFFFF',
  border: '#EBE3D3',
  textPrim: '#1A1A17',
  textSec: '#6B6356',
  textMuted: '#8A8270',
  green: '#15803D',
  greenMid: '#16A34A',
  cashBg: '#E7F2E9',
  cashFg: '#15803D',
  orange: '#F47A20',
  moov: '#1E5BD6',
  ussdBg: '#FBF3DC',
  ussdBorder: '#E4CF95',
  ussdFg: '#1A1A17',
  successBg: '#F3F9EF',
  successBorder: '#16A34A',
  activeBg: '#F4FAF0',
  radius: { card: 18, method: 16, field: 13, otp: 13, pill: 999 },
} as const;
