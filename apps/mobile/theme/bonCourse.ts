import { Platform } from 'react-native';

/**
 * Tokens de la direction « bon de course » (écrans 3/4 et 4/4 livreur).
 * Une seule source de vérité pour les couleurs et les polices.
 *
 * Polices : on n'utilise QUE des faces déjà embarquées par _layout
 *  - sans-serif  → Inter (400/500/600/700 ; pas de 800 dans le bundle → 700 = max)
 *  - mono/donnée → monospace système (Menlo iOS / monospace Android), déjà la
 *    convention de l'app (Space Mono Bold n'est pas embarqué).
 */
export const BC = {
  papier: '#FEFDF8',
  page: '#EFEDE3',
  encre: '#1F211E',
  gris: '#6E6B63',
  attente: '#767366',
  filet: '#D9D6C9',
  filetFin: '#E7E4D8',
  vert: '#0E7A44',
  vertProfond: '#0A5C33',
  blanc: '#FFFFFF',
} as const;

export const BF = {
  // sans-serif (Inter)
  med: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  // « Inter 800 » du prompt non embarqué → on prend la graisse max dispo (700).
  xbold: 'Inter_700Bold',
  // mono / donnée
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!,
} as const;
