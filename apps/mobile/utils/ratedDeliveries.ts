import AsyncStorage from '@react-native-async-storage/async-storage';

// Mémorise localement les courses déjà notées : une note est UNIQUE par course
// (le serveur refuse une 2e note). Sert à griser « Envoyer mon avis » ET à
// considérer une course livrée+notée comme TERMINÉE (plus de bandeau « Notez »).
const RATED_KEY = 'ratedDeliveryIds';

export async function markRatedLocally(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(RATED_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(id)) {
      ids.push(id);
      await AsyncStorage.setItem(RATED_KEY, JSON.stringify(ids.slice(-200)));
    }
  } catch {
    /* silencieux */
  }
}

export async function isRatedLocally(id: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(RATED_KEY);
    return raw ? (JSON.parse(raw) as string[]).includes(id) : false;
  } catch {
    return false;
  }
}
