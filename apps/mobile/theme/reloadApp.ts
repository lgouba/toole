import * as Updates from 'expo-updates';
import { DevSettings } from 'react-native';

/**
 * Recharge le bundle JS de l'app pour que tous les `StyleSheet.create`
 * (figés à l'import) reprennent la nouvelle palette de couleurs.
 *
 * - Build natif / OTA (prod) : `Updates.reloadAsync()`.
 * - Dev / Expo Go (Updates désactivé) : fallback `DevSettings.reload()`.
 * - Sinon : no-op silencieux (comportement actuel = prise en compte au prochain
 *   démarrage à froid). Ne jette jamais.
 */
export async function reloadApp(): Promise<void> {
  try {
    if (Updates.isEnabled) {
      await Updates.reloadAsync();
      return;
    }
  } catch {
    // tombe dans le fallback dev ci-dessous
  }
  try {
    DevSettings.reload();
  } catch {
    // no-op : rien de mieux à faire, on garde la palette au prochain cold start
  }
}
