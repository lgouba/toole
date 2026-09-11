import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Indice de sous-étape LIVREUR persistant. Certaines sous-étapes du flux
 * (ex. « code-validation » : arrivé + photo + code) sont purement clientes :
 * aucun statut DB ne les distingue de l'écran de navigation. Sur Android, la
 * caméra peut faire tuer la MainActivity → au retour l'app remonte à froid et
 * le guard, qui route par statut, renverrait le livreur sur delivery-navigation
 * au lieu de code-validation. On mémorise donc la sous-étape ici pour la
 * restaurer. Nettoyé au démontage normal de l'écran (donc uniquement absent si
 * le process a été tué → c'est justement là qu'on veut restaurer).
 */
const KEY = 'driverFlowStep';

export type DriverFlowStep = { deliveryId: string; step: 'code' };

export async function setDriverFlowStep(s: DriverFlowStep): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* silencieux */
  }
}

export async function getDriverFlowStep(): Promise<DriverFlowStep | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DriverFlowStep) : null;
  } catch {
    return null;
  }
}

export async function clearDriverFlowStep(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* silencieux */
  }
}
