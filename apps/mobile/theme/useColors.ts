import { useSettingsStore } from '@/stores/settings.store';
import { colors } from './colors';

/**
 * Hook qui retourne la palette de couleurs courante. Re-render automatique
 * quand l'admin change les couleurs dans les paramètres.
 *
 * En pratique retourne l'objet `colors` global (qui est mute par
 * `applyDynamicColors` dans ThemeGate), mais en souscrivant au store
 * pour que React re-render le composant.
 */
export function useColors() {
  // Souscrit au store pour trigger un re-render quand les couleurs changent
  useSettingsStore((s) => s.settings.primaryColor);
  useSettingsStore((s) => s.settings.secondaryColor);
  return colors;
}

export type ThemeColors = typeof colors;
