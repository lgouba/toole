/**
 * Heure de Ouagadougou (Burkina Faso) — l'app est Burkina-only.
 *
 * Le Burkina est en GMT (UTC+0) TOUTE L'ANNÉE (aucun changement d'heure). Donc
 * l'heure "murale" de Ouaga == l'heure UTC. On force la saisie ET l'affichage
 * des horaires de programmation sur ce fuseau, pour que l'heure soit COHÉRENTE
 * quel que soit le fuseau du téléphone (utile en test hors Burkina, robuste si
 * un utilisateur voyage).
 *
 * ⚠️ Ne PAS remplacer `getUTC*` / `Date.UTC` par les variantes locales : c'est
 * justement ce qui garantit l'heure de Ouaga indépendamment du fuseau appareil.
 * Sur un appareil AU Burkina (UTC+0), ces fonctions donnent exactement le même
 * résultat que les variantes locales -> aucune régression en production.
 */

export const OUAGA_TZ = 'Africa/Ouagadougou';

export interface OuagaParts {
  y: number;
  mo: number; // 1-12
  d: number; // 1-31
  h: number; // 0-23
  mi: number; // 0-59
}

/** Composants "heure murale de Ouaga" d'un instant (Date). */
export function ouagaParts(date: Date): OuagaParts {
  return {
    y: date.getUTCFullYear(),
    mo: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
    h: date.getUTCHours(),
    mi: date.getUTCMinutes(),
  };
}

/** Construit l'instant ISO à partir d'une heure murale de Ouaga. */
export function ouagaWallClockToISO(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
): string {
  return new Date(Date.UTC(y, mo - 1, d, h, mi, 0, 0)).toISOString();
}

/** Formate un instant (Date | ISO) en heure de Ouaga (fr-FR). */
export function formatOuaga(
  input: Date | string | null | undefined,
  opts: Intl.DateTimeFormatOptions,
): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { timeZone: OUAGA_TZ, ...opts });
}
