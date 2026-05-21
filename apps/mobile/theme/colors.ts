/**
 * Palette de couleurs mutable (pas `as const`) : les valeurs primary /
 * secondary peuvent etre ecrasees au runtime par applyDynamicColors()
 * quand l'admin modifie les paramètres via la page Paramètres.
 *
 * Les composants qui importent directement `colors` (StyleSheet.create
 * au top-level) verront les nouvelles valeurs au prochain rendu, car
 * l'objet est partage par référence.
 *
 * MAIS attention : les styles produits par StyleSheet.create sont
 * figes a l'import du composant. Pour que les changements soient
 * IMMEDIATS, il faut une clef de re-render (cf. ThemeGate dans
 * providers/ThemeGate.tsx).
 */
/**
 * Palette "Friendly & Local" (Concept C) — terra cotta + sable + vert kola.
 * Chaleureux, ancre localement, evoque les couleurs du Burkina Faso.
 * L'admin peut surcharger primary + secondary via Parametres.
 */
export const colors = {
  primary: '#C2410C',        // Terra cotta : couleur principale
  primaryDark: '#9A3412',
  primaryLight: '#FED7AA',   // Pastel pour fonds doux
  secondary: '#15803D',      // Vert kola : success + CTA secondaire
  secondaryLight: '#D1FAE5',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  success: '#15803D',
  successLight: '#D1FAE5',
  background: '#FFFBEB',      // Sable doux pour le fond global
  surface: '#FEF3C7',         // Sable un peu plus marque pour les zones
  textPrimary: '#1C1917',
  textSecondary: '#57534E',
  textTertiary: '#A8A29E',
  border: '#E7E5E4',
  borderFocus: '#C2410C',
  white: '#FFFFFF',
  black: '#0A0A0A',
  overlay: 'rgba(28, 25, 23, 0.55)',
};

export type ColorName = keyof typeof colors;

/**
 * Palette par defaut, gardee en référence pour pouvoir reset les
 * couleurs derivees (light/dark) quand l'admin remet les defauts.
 */
const DEFAULT_PRIMARY = '#C2410C';
const DEFAULT_SECONDARY = '#15803D';

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
