/**
 * Tokens dédiés à l'écran d'authentification (maquette premium validée).
 * Indépendants du thème dynamique admin : ces valeurs reproduisent fidèlement
 * la maquette HTML (vert #00C853, carte de livraison, etc.).
 */
export const authColors = {
  primary: '#00C853',
  secondary: '#00E676',
  accent: '#FFD54F',
  bg: '#F8FAFC',
  text: '#0F172A',
  muted: '#64748B',
  line: '#E2E8F0',
  white: '#FFFFFF',
  // décor carte
  cityBlock: '#EEF3F0',
  park: '#D9F0E0',
  water: '#D7ECF7',
  road: '#F4F8F6',
  routeGhost: '#C7ECD6',
  pillBg: '#E7FBEF',
} as const;

export const authFonts = {
  // Bricolage Grotesque — titres / display
  displayBold: 'BricolageGrotesque_700Bold',
  displayExtra: 'BricolageGrotesque_800ExtraBold',
  // Plus Jakarta Sans — corps
  bodyRegular: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
} as const;

export const authRadius = {
  card: 32,
  field: 16,
  pill: 999,
} as const;
