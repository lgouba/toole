import { useEffect } from 'react';
import Constants from 'expo-constants';

/**
 * Hook qui verifie automatiquement la presence d'un update OTA Expo et le
 * telecharge + applique sans demander a l'utilisateur (transparent).
 *
 * **Comportement** : check UNIQUEMENT au cold start (mount de l'app).
 * On NE check PAS sur le retour en foreground car cela peut declencher un
 * reload de l'app au milieu d'une action critique (modal de course active,
 * formulaire en cours, etc.) et faire perdre du contexte a l'utilisateur.
 *
 * Si un update est publie pendant que l'app tourne, il sera applique au
 * prochain demarrage complet de l'app — donc pas immediat mais sans risque
 * d'interruption.
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

    (async () => {
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
          // Reload immediate au cold start : l'utilisateur n'est pas encore
          // engage dans une action, donc safe.
          await Updates.reloadAsync();
        }
      } catch (err) {
        console.warn('[AutoUpdate] check failed', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
