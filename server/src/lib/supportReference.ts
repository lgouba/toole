/**
 * Génère une référence lisible de ticket support : `SUP-` + 6 caractères
 * base36 majuscules (ex. `SUP-7K2Q9Z`). ~2,1 milliards de combinaisons, large
 * pour l'usage. Aléa CSPRNG. L'unicité réelle est garantie par `@unique` en DB.
 */
import { randomInt } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateSupportReference(): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `SUP-${suffix}`;
}
