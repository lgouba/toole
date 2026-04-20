import { Vibration, Platform } from 'react-native';
import { haptic } from './haptics';

/**
 * Alerte forte pour attirer l'attention du livreur quand une course tombe,
 * meme telephone en poche / silencieux :
 *  - Vibration longue et rythmee (~2s sur Android avec pattern natif)
 *  - Haptic repete (iOS)
 *  - Le SON est gere par expo-notifications (son systeme par defaut)
 */
export function alertNewRequest() {
  if (Platform.OS === 'android') {
    // Android : pattern [wait, vibrate, wait, vibrate, ...] — non-repetitif
    Vibration.vibrate([0, 600, 180, 400, 180, 400, 180, 600], false);
  } else {
    // iOS : pas de pattern avec duree variable, on enchaine les haptic heavy
    Vibration.vibrate();
    haptic.heavy();
    setTimeout(() => haptic.heavy(), 200);
    setTimeout(() => haptic.heavy(), 450);
    setTimeout(() => haptic.heavy(), 750);
    setTimeout(() => haptic.success(), 1100);
  }
}

/**
 * Feedback "action critique reussie" (accepter course, valider code...).
 * Double tap tactile court qui se ressent bien meme sans regarder l'ecran.
 */
export function alertConfirmSuccess() {
  haptic.success();
  setTimeout(() => haptic.medium(), 80);
}

/** Feedback court d'erreur / refus. */
export function alertRejection() {
  haptic.warning();
}

/** Feedback simple pour confirmer un tap important. */
export function alertTap() {
  haptic.medium();
}

/** Stop immediate d'une vibration en cours (ex: le livreur a repondu). */
export function stopAlert() {
  Vibration.cancel();
}
