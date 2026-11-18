import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSettingsStore } from '@/stores/settings.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useDriverStore } from '@/stores/driver.store';
import { applyDynamicColors } from '@/theme/colors';
import { shouldReloadForColors, isSafeToReload, type ColorPair } from '@/theme/colorReload';
import { reloadApp } from '@/theme/reloadApp';

/**
 * Applique les couleurs dynamiques de l'admin sur l'objet `colors` global, et —
 * quand la couleur change VRAIMENT en cours de session — recharge proprement l'app
 * pour que tous les `StyleSheet.create` (figés à l'import) reprennent la palette,
 * sans force-quit manuel.
 *
 * Garde-fous :
 *  - baseline fixée APRÈS hydratation du store persistant → pas de reload sur la
 *    transition défaut → couleur persistée au démarrage (sinon : boucle de reload) ;
 *  - reload uniquement app au premier plan ET aucune course active (client/livreur),
 *    sinon différé jusqu'à ce que ce soit sûr ;
 *  - petit délai avant reload pour laisser le store persister la nouvelle couleur.
 *
 * Les composants `useColors()` se mettent à jour sans reload ; le reload ne sert
 * qu'aux (nombreux) composants qui figent `colors.x` dans un StyleSheet top-level.
 */
export function ThemeGate({ children }: { children: React.ReactNode }) {
  const primaryColor = useSettingsStore((s) => s.settings.primaryColor);
  const secondaryColor = useSettingsStore((s) => s.settings.secondaryColor);

  const appliedRef = useRef(false);
  const baselineRef = useRef<ColorPair | null>(null);
  const pendingRef = useRef<ColorPair | null>(null);

  // 1er render : applique la palette AVANT que les enfants ne fassent leurs
  // StyleSheet.create. Pas de baseline encore → aucun reload possible ici.
  if (!appliedRef.current) {
    applyDynamicColors(primaryColor, secondaryColor);
    appliedRef.current = true;
  }

  const hasActiveDelivery = () =>
    useDeliveryStore.getState().activeDelivery != null ||
    useDriverStore.getState().activeDelivery != null;

  const tryReload = (next: ColorPair) => {
    const safe = isSafeToReload({
      appActive: AppState.currentState === 'active',
      hasActiveDelivery: hasActiveDelivery(),
    });
    if (safe) {
      pendingRef.current = null;
      // Laisse le store persister la nouvelle couleur avant de recharger,
      // pour que la baseline au redémarrage soit déjà la bonne (pas de 2e reload).
      setTimeout(() => {
        void reloadApp();
      }, 500);
    } else {
      pendingRef.current = next; // différé
    }
  };

  // Arme la baseline une fois le store persistant hydraté.
  useEffect(() => {
    const arm = () => {
      if (baselineRef.current) return;
      const { primaryColor: p, secondaryColor: s } = useSettingsStore.getState().settings;
      applyDynamicColors(p, s);
      baselineRef.current = { primary: p, secondary: s };
    };
    if (useSettingsStore.persist.hasHydrated()) {
      arm();
      return;
    }
    const unsub = useSettingsStore.persist.onFinishHydration(arm);
    return unsub;
  }, []);

  // Changement de couleur : applique toujours, et recharge si la baseline est
  // armée et que la palette a réellement changé.
  useEffect(() => {
    const next: ColorPair = { primary: primaryColor, secondary: secondaryColor };
    applyDynamicColors(next.primary, next.secondary);
    if (shouldReloadForColors(baselineRef.current, next)) {
      baselineRef.current = next;
      tryReload(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryColor, secondaryColor]);

  // Rejoue un reload différé quand l'app revient au premier plan.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pendingRef.current) tryReload(pendingRef.current);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rejoue un reload différé quand plus aucune course n'est active.
  useEffect(() => {
    const check = () => {
      if (pendingRef.current && !hasActiveDelivery()) tryReload(pendingRef.current);
    };
    const unsubA = useDeliveryStore.subscribe(check);
    const unsubB = useDriverStore.subscribe(check);
    return () => {
      unsubA();
      unsubB();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
