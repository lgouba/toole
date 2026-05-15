import { useEffect } from 'react';
import { AppState } from 'react-native';
import Constants from 'expo-constants';

/**
 * Hook qui verifie automatiquement la presence d'un update OTA Expo et le
 * telecharge + applique sans demander a l'utilisateur (transparent).
 *
 * Comportement :
 *   - Au mount (app demarre)
 *   - A chaque retour en foreground (l'utilisateur revient sur l'app apres
 *     l'avoir minimisee)
 *
 * Si un update est trouve, il est telecharge en BG puis Updates.reloadAsync()
 * relance l'app instantanement avec le nouveau bundle. Plus besoin pour
 * l'utilisateur de force-close l'app 2 fois.
 *
 * Skip en dev (Expo Go ou Metro) ou si expo-updates n'est pas dispo.
 */
export function useAutoUpdate() {
  useEffect(() => {
    // Skip en dev / Expo Go : expo-updates ne fonctionne qu'avec un build.
    const isDevClient =
      Constants.executionEnvironment === 'storeClient' || __DEV__;
    if (isDevClient) return;

    let cancelled = false;

    const check = async () => {
      try {
        const Updates = await import('expo-updates');
        if (!Updates.isEnabled) return;
        const result = await Updates.checkForUpdateAsync();
        if (cancelled) return;
        if (result.isAvailable) {
          console.log('[AutoUpdate] new update available, fetching...');
          await Updates.fetchUpdateAsync();
          if (cancelled) return;
          console.log('[AutoUpdate] update fetched, reloading app');
          // Reload immediate : l'utilisateur voit l'app rebooter brievement
          // (~1s) avec le nouveau code. Sans ca il faut force-close 2x.
          await Updates.reloadAsync();
        }
      } catch (err) {
        console.warn('[AutoUpdate] check failed', err);
      }
    };

    // 1er check au demarrage
    check();

    // Re-check a chaque retour en foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
