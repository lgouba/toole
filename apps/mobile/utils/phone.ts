/**
 * Téléphone Burkina Faso (+226, 8 chiffres). Affichage groupé "70 12 34 56".
 * On stocke la valeur NATIONALE (8 chiffres) dans le draft ; le backend
 * (cleanPhone) la normalise en 226XXXXXXXX. `toE164` fournit le +226XXXXXXXX.
 */

export function digitsOnly(s: string): string {
  return (s || '').replace(/\D/g, '');
}

/** Extrait les 8 chiffres nationaux depuis n'importe quelle saisie (+226, 226, espaces…). */
export function toNational(raw: string): string {
  let d = digitsOnly(raw);
  if (d.length > 8 && d.startsWith('226')) d = d.slice(3);
  return d.slice(0, 8);
}

/** "70 12 34 56" à partir d'une valeur nationale (ou partielle). */
export function formatNational(raw: string): string {
  const d = toNational(raw);
  return d.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

/** Valide un numéro national BF : 8 chiffres. */
export function isValidBF(raw: string): boolean {
  return /^\d{8}$/.test(toNational(raw));
}

/** Format E.164 : +226XXXXXXXX (null si invalide). */
export function toE164(raw: string): string | null {
  const n = toNational(raw);
  return isValidBF(n) ? `+226${n}` : null;
}
