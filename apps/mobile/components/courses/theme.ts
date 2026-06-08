// Tokens dédiés à la modale "Nouvelle course" (concept Mission, vert sombre premium).
export const T = {
  vivid: '#00E676',
  primary: '#00C853',
  deepA: '#0B7C4F',
  bgTop: '#1C7D4D',
  bgMid: '#0F5A36',
  bgLow: '#0A3A24',
  bgEnd: '#072518',
  card: 'rgba(8,30,20,0.55)',
  cardBorder: 'rgba(255,255,255,0.12)',
  white: '#FFFFFF',
  mint: '#AEF4CB',
  textMut: '#8FB6A2',
  routeMut: '#7FB79A',
  amber: '#FFD54F',
  orange: '#FF8A3D',
  red: '#FF5252',
  knob: '#FFFFFF',
  knobInk: '#0B7C4F',
} as const;

// Polices déjà chargées dans _layout (clés expo-google-fonts).
export const FONT = {
  disp: 'BricolageGrotesque_800ExtraBold',
  dispBold: 'BricolageGrotesque_700Bold',
  body: 'PlusJakartaSans_500Medium',
  bodyBold: 'PlusJakartaSans_700Bold',
} as const;

export const RAD = { card: 24, chip: 13, track: 20, knob: 14 } as const;
