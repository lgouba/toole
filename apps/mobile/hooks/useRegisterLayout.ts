import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Système de paliers de l'inscription « la carte qui se construit ».
 *
 * Toute la compression se fait dans la zone de saisie ; l'en-tête, la carte et
 * le bouton restent fixes. Le palier est déterminé au montage (via les
 * dimensions courantes) et NE change pas pendant un parcours — la carte ne
 * bouge donc jamais d'un pixel d'une étape à l'autre.
 */
export type Palier = 'confort' | 'compact' | 'serre';

export interface RegisterLayout {
  palier: Palier;
  isLandscape: boolean;
  gutter: number;
  /** Largeur de la carte (= colonne de saisie), plafonnée à 420. */
  cardW: number;
  /** Hauteur de la carte selon le palier (208 / 176 / 148). */
  cardH: number;
  /** Écart vertical entre les rangées internes de la carte. */
  cardRowGap: number;
  /** Padding vertical interne de la carte. */
  cardPadV: number;
  /** Le nom du titulaire est empilé nom/tel sur 2 lignes sous 320 pt. */
  stackBottomRow: boolean;
  height: number;
  width: number;
  fontScale: number;
  insetTop: number;
  insetBottom: number;
}

export function useRegisterLayout(): RegisterLayout {
  const { height, width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isLandscape = width > height;
  // Palier par la hauteur ; fontScale ≥ 1.5 force « serré » quelle que soit la taille.
  let palier: Palier = height >= 800 ? 'confort' : height >= 640 ? 'compact' : 'serre';
  if (fontScale >= 1.5) palier = 'serre';

  const gutter = width >= 400 ? 24 : 20;
  const cardW = Math.min(width - 2 * gutter, 420);

  const cardH = palier === 'confort' ? 208 : palier === 'compact' ? 176 : 148;
  const cardRowGap = palier === 'confort' ? 22 : 14;
  const cardPadV = palier === 'confort' ? 20 : 12;
  const stackBottomRow = width < 320;

  return {
    palier,
    isLandscape,
    gutter,
    cardW,
    cardH,
    cardRowGap,
    cardPadV,
    stackBottomRow,
    height,
    width,
    fontScale,
    insetTop: insets.top,
    insetBottom: insets.bottom,
  };
}
