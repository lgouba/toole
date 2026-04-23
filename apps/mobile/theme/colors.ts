/**
 * Palette de couleurs mutable (pas `as const`) : les valeurs primary /
 * secondary peuvent etre ecrasees au runtime par applyDynamicColors()
 * quand l'admin modifie les parametres via la page Parametres.
 *
 * Les composants qui importent directement `colors` (StyleSheet.create
 * au top-level) verront les nouvelles valeurs au prochain rendu, car
 * l'objet est partage par reference.
 *
 * MAIS attention : les styles produits par StyleSheet.create sont
 * figes a l'import du composant. Pour que les changements soient
 * IMMEDIATS, il faut une clef de re-render (cf. ThemeGate dans
 * providers/ThemeGate.tsx).
 */
export const colors = {
  primary: '#1D9E75',
  primaryDark: '#0F6E56',
  primaryLight: '#E1F5EE',
  secondary: '#D85A30',
  secondaryLight: '#FFF0EB',
  warning: '#EF9F27',
  warningLight: '#FFF8E7',
  error: '#DC3545',
  errorLight: '#FFE8EA',
  success: '#1D9E75',
  successLight: '#E1F5EE',
  background: '#FFFFFF',
  surface: '#F5F5F0',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#9B9B9B',
  border: '#E5E5E0',
  borderFocus: '#1D9E75',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export type ColorName = keyof typeof colors;

/**
 * Palette par defaut, gardee en reference pour pouvoir reset les
 * couleurs derivees (light/dark) quand l'admin remet les defauts.
 */
const DEFAULT_PRIMARY = '#1D9E75';
const DEFAULT_SECONDARY = '#D85A30';

function mixWithWhite(hex: string, ratio = 0.86): string {
  try {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    const mix = (c: number) => Math.round(c + (255 - c) * ratio);
    const toHex = (c: number) => mix(c).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return hex;
  }
}

function darken(hex: string, ratio = 0.25): string {
  try {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    const dark = (c: number) => Math.max(0, Math.round(c * (1 - ratio)));
    const toHex = (c: number) => dark(c).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return hex;
  }
}

/**
 * Applique un nouveau jeu de couleurs dynamiques. Muter l'objet `colors`
 * en place permet aux composants importants `colors.primary` de voir la
 * nouvelle valeur au prochain rendu.
 */
export function applyDynamicColors(
  primary: string = DEFAULT_PRIMARY,
  secondary: string = DEFAULT_SECONDARY,
) {
  colors.primary = primary;
  colors.primaryDark = darken(primary);
  colors.primaryLight = mixWithWhite(primary);
  colors.secondary = secondary;
  colors.secondaryLight = mixWithWhite(secondary);
  colors.success = primary;
  colors.successLight = mixWithWhite(primary);
  colors.borderFocus = primary;
}
