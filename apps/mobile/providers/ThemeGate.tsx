import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/settings.store';
import { applyDynamicColors } from '@/theme/colors';

/**
 * Applique les couleurs dynamiques de l'admin sur l'objet `colors` global.
 *
 * Note importante : les composants utilisent `StyleSheet.create` avec
 * `colors.primary` evalue a l'import, donc les styles déjà rendus ne sont
 * PAS automatiquement mis a jour. Les nouvelles couleurs s'appliqueront :
 *   - immediatement via `useColors()` (composants refactores : Button,
 *     Badge, Input, etc.)
 *   - au prochain `StyleSheet.create` d'un nouveau composant monté
 *   - au prochain redemarrage complet de l'app
 *
 * Pour les composants déjà montes qui utilisent `colors.xxx` directement
 * dans un StyleSheet : ils garderont les couleurs d'origine jusqu'au
 * prochain rechargement. L'admin le sait (message dans la page Paramètres).
 */
export function ThemeGate({ children }: { children: React.ReactNode }) {
  const primaryColor = useSettingsStore((s) => s.settings.primaryColor);
  const secondaryColor = useSettingsStore((s) => s.settings.secondaryColor);
  const appliedRef = useRef(false);

  // Applique les couleurs au tout premier render (avant que les composants
  // enfants ne fassent leurs StyleSheet.create)
  if (!appliedRef.current) {
    applyDynamicColors(primaryColor, secondaryColor);
    appliedRef.current = true;
  }

  useEffect(() => {
    applyDynamicColors(primaryColor, secondaryColor);
  }, [primaryColor, secondaryColor]);

  return <>{children}</>;
}
