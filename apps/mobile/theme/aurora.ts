import { Platform } from 'react-native';

/**
 * Direction « Aurora » (clair + tech). Fond lumineux froid, verre dépoli,
 * dégradé menthe → teal → kola en signature, accent qui glow doucement.
 * Une seule source de vérité pour les écrans du parcours de course.
 */
export const AU = {
  ground: '#EEF1F4',
  groundDeep: '#E6EBEF',
  glass: 'rgba(255,255,255,0.82)',
  glassSoft: 'rgba(255,255,255,0.62)',
  glassBorder: 'rgba(255,255,255,0.9)',
  hairline: 'rgba(20,40,50,0.09)',
  ink: '#141A1F',
  ink2: '#2B333A',
  muted: '#68727B',
  faint: '#9AA4AC',
  kola: '#0E7A44',
  teal: '#12B58A',
  mint: '#7BE0A6',
  white: '#FFFFFF',
  danger: '#D6453C',
} as const;

export const AF = {
  disp: 'BricolageGrotesque_800ExtraBold',
  dispB: 'BricolageGrotesque_700Bold',
  med: 'PlusJakartaSans_500Medium',
  semi: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!,
} as const;

/** Ombre douce « premium » pour le verre. */
export const glassShadow = {
  shadowColor: '#1E3240',
  shadowOpacity: 0.16,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 14 },
  elevation: 8,
} as const;

/** Halo vert (glow) pour l'accent/CTA. */
export const kolaGlow = {
  shadowColor: '#12B58A',
  shadowOpacity: 0.5,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
} as const;
