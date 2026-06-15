import { APP_TIMEZONE } from '@/theme/recapTokens';

/**
 * Logique de programmation des livraisons.
 *
 * Le service opère à Ouagadougou (Africa/Ouagadougou = UTC+0, SANS DST). Comme
 * l'offset est nul, l'heure murale de Ouaga == UTC. On fait donc toute
 * l'arithmétique avec les getters/setters UTC de Date (robuste quel que soit le
 * fuseau du téléphone du testeur), et on AFFICHE via Intl en `APP_TIMEZONE`.
 *
 * Rien n'est hardcodé : tout dérive de `new Date()` (instant absolu courant).
 */

export type SlotIcon = 'bolt' | 'moon' | 'sun';

export interface Slot {
  key: string;
  label: string;
  icon: SlotIcon;
  at: Date;
}

/** Délai minimum avant une livraison programmée (peut être surchargé par les settings). */
export const DEFAULT_MIN_LEAD_MIN = 15;

function addMinutes(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60_000);
}

/** Construit une Date à l'heure murale Ouaga (UTC+0) du même JOUR que `ref`. */
function atOuagaToday(ref: Date, hour: number, minute: number): Date {
  return new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), hour, minute, 0, 0),
  );
}

/** Idem mais le LENDEMAIN (le Date.UTC normalise le débordement de jour/mois). */
function atOuagaTomorrow(ref: Date, hour: number, minute: number): Date {
  return new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + 1, hour, minute, 0, 0),
  );
}

/**
 * Génère les créneaux suggérés à partir de l'instant courant.
 * Filtre tout créneau antérieur à `now + minLeadMin`.
 */
export function generateSlots(now: Date, minLeadMin = DEFAULT_MIN_LEAD_MIN): Slot[] {
  const slots: Slot[] = [
    { key: 'plus1h', label: 'Dans 1h', icon: 'bolt', at: addMinutes(now, 60) },
    { key: 'plus2h', label: 'Dans 2h', icon: 'bolt', at: addMinutes(now, 120) },
    { key: 'tonight', label: 'Ce soir', icon: 'moon', at: atOuagaToday(now, 18, 0) },
    { key: 'tomAM', label: 'Demain matin', icon: 'sun', at: atOuagaTomorrow(now, 9, 0) },
    { key: 'tomPM', label: 'Demain soir', icon: 'moon', at: atOuagaTomorrow(now, 18, 0) },
  ];
  const floor = now.getTime() + minLeadMin * 60_000;
  return slots.filter((s) => s.at.getTime() >= floor);
}

// ----- Formatage (locale fr-FR, fuseau opérationnel) -----

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('fr-FR', { timeZone: APP_TIMEZONE, ...opts });
    fmtCache.set(key, f);
  }
  return f;
}

/** "lun. 15 juin à 01:23" */
export function formatNowLong(d: Date): string {
  const day = fmt({ weekday: 'short', day: 'numeric', month: 'long' }).format(d);
  const time = fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${day} à ${time}`;
}

/** "01:23" */
export function formatTimeHM(d: Date): string {
  return fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/** "lun. 15" */
export function formatDayShort(d: Date): string {
  return fmt({ weekday: 'short', day: 'numeric' }).format(d);
}

/**
 * Champs Date/Heure : on lit les composantes en heure murale Ouaga (= UTC+0,
 * donc getters UTC). { dd, mm, yyyy, HH, MM } en chaînes prêtes à afficher.
 */
export function ouagaFields(d: Date): {
  dd: string;
  mm: string;
  yyyy: string;
  HH: string;
  MM: string;
} {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return {
    dd: p2(d.getUTCDate()),
    mm: p2(d.getUTCMonth() + 1),
    yyyy: String(d.getUTCFullYear()),
    HH: p2(d.getUTCHours()),
    MM: p2(d.getUTCMinutes()),
  };
}

/** Construit une Date depuis des composantes murales Ouaga (UTC+0). */
export function dateFromOuagaParts(
  year: number,
  month1: number, // 1..12
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(year, month1 - 1, day, hour, minute, 0, 0));
}

export const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Nombre de jours dans le mois (1..12) d'une année donnée. */
export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}
