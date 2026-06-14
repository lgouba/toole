import * as Location from 'expo-location';
import { LatLng } from '@/types';

export interface GeocodeSuggestion {
  location: LatLng;
  displayName: string;
  shortName: string;
  /**
   * true si la suggestion pointe vers une adresse precise (rue, numéro,
   * batiment) plutôt qu'une zone large (ville, departement). Utilise pour
   * avertir le livreur si l'adresse est trop floue.
   */
  isPrecise: boolean;
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const UA = 'Tolle/1.0 (contact@tolle.bf)';
const TIMEOUT_MS = 8000;

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(handle);
  }
}

export interface CityBbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Recherche des adresses pour l'autocompletion.
 *
 * Strategie en escalier (du plus strict au plus permissif) :
 *
 * 1. `cityBbox` fourni → viewbox = bbox exacte de la ville + bounded=1.
 *    Resultats STRICTEMENT dans la ville (ex: Nice). Plus de "Burger King Paris"
 *    quand on est a Nice. C'est le mode recommande des qu'on a detecte la ville.
 *
 * 2. Pas de bbox mais `countryCode` fourni → countrycodes=cc + viewbox bias 50km
 *    autour de biasLocation. Resultats dans le pays uniquement.
 *
 * 3. Rien fourni → recherche mondiale (debug / fallback uniquement).
 */
export async function searchAddresses(
  query: string,
  biasLocation?: LatLng,
  countryCode?: string | null,
  cityBbox?: CityBbox | null,
): Promise<GeocodeSuggestion[]> {
  if (!query || query.trim().length < 3) return [];

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    limit: '6',
    'accept-language': 'fr',
    addressdetails: '1',
  });

  if (countryCode) {
    params.set('countrycodes', countryCode);
  }

  if (cityBbox) {
    // Mode strict ville : viewbox = bbox Nominatim de la ville + bounded=1
    // (= filtre dur, pas seulement un bias).
    // Format Nominatim viewbox : left,top,right,bottom = west,north,east,south
    params.set(
      'viewbox',
      `${cityBbox.west},${cityBbox.north},${cityBbox.east},${cityBbox.south}`,
    );
    params.set('bounded', '1');
  } else if (biasLocation) {
    // Mode soft : bias 50km autour de la position, pas de bounded
    // (au cas ou le GPS soit peu fiable / l'user au bord de la zone).
    const { latitude, longitude } = biasLocation;
    const delta = 0.5;
    params.set(
      'viewbox',
      `${longitude - delta},${latitude + delta},${longitude + delta},${latitude - delta}`,
    );
    params.set('bounded', '0');
  }

  const data = await fetchJson<
    Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: Record<string, string>;
    }>
  >(`${NOMINATIM_BASE}/search?${params}`);

  if (!data) return [];

  return data.map((d) => ({
    location: { latitude: parseFloat(d.lat), longitude: parseFloat(d.lon) },
    displayName: d.display_name,
    shortName: buildShortName(d),
    isPrecise: isPreciseAddress(d),
  }));
}

/**
 * Une suggestion est consideree "precise" si Nominatim a identifie
 * un numéro de maison, une rue, un batiment / commerce / amenity.
 * Un resultat qui ne contient que city/state/country est imprecis.
 */
function isPreciseAddress(d: {
  address?: Record<string, string>;
}): boolean {
  const a = d.address ?? {};
  return !!(
    a.house_number ||
    a.road ||
    a.pedestrian ||
    a.footway ||
    a.residential ||
    a.building ||
    a.amenity ||
    a.shop ||
    a.office ||
    a.tourism ||
    a.leisure ||
    a.neighbourhood
  );
}

export async function geocodeAddress(
  query: string,
  biasLocation?: LatLng,
): Promise<GeocodeSuggestion | null> {
  const results = await searchAddresses(query, biasLocation);
  return results[0] ?? null;
}

/** Distance (mètres) entre deux points GPS — formule de Haversine. */
function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Construit une bbox carrée autour d'un point (deltaDeg ≈ 0.22 ° ≈ 24 km). */
export function bboxAround(center: LatLng, deltaDeg = 0.22): CityBbox {
  return {
    south: center.latitude - deltaDeg,
    north: center.latitude + deltaDeg,
    west: center.longitude - deltaDeg,
    east: center.longitude + deltaDeg,
  };
}

/** Étiquette de ZONE (quartier/secteur + ville) — honnête quand l'adresse précise est inconnue. */
function buildAreaLabel(d: { address?: Record<string, string> }): string {
  const a = d.address ?? {};
  const sector =
    a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district;
  const city = a.city || a.town || a.village || a.municipality;
  return [sector, city].filter(Boolean).join(', ');
}

/**
 * Reverse-geocode natif (Apple/Google). Renvoie l'adresse DU point exact
 * (pas "la feature la plus proche" comme Nominatim), donc pas de décalage.
 */
async function nativeReverse(
  loc: LatLng,
): Promise<{ label: string; precise: boolean } | null> {
  try {
    const r = (await Location.reverseGeocodeAsync(loc))[0];
    if (!r) return null;
    const street =
      r.streetNumber && r.street
        ? `${r.streetNumber} ${r.street}`
        : r.street || r.name || null;
    const area = r.district || (r as any).subregion || null;
    const city = r.city || r.region || null;
    const seen = new Set<string>();
    const parts = [street, area, city].filter((x): x is string => {
      if (!x || seen.has(x)) return false;
      seen.add(x);
      return true;
    });
    if (parts.length === 0) return null;
    // "precise" si on a une vraie rue (pas juste ville/région).
    const precise = !!r.street;
    return { label: parts.join(', '), precise };
  } catch {
    return null;
  }
}

/**
 * Reverse-geocode Nominatim avec VALIDATION DE DISTANCE : si la feature
 * renvoyée est à plus de ~150 m du point demandé, c'est une autre adresse
 * proche → on ne la présente PAS comme l'adresse exacte (on tombe sur la zone).
 */
async function nominatimReverse(
  loc: LatLng,
): Promise<{ label: string; precise: boolean } | null> {
  const params = new URLSearchParams({
    lat: String(loc.latitude),
    lon: String(loc.longitude),
    format: 'json',
    'accept-language': 'fr',
    zoom: '18',
    addressdetails: '1',
  });
  const data = await fetchJson<{
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: Record<string, string>;
  }>(`${NOMINATIM_BASE}/reverse?${params}`);
  if (!data) return null;

  const a = data.address ?? {};
  const hasStreet = !!(
    a.road || a.pedestrian || a.footway || a.residential || a.house_number
  );
  // Distance entre le point demandé et la feature renvoyée par Nominatim.
  let closeEnough = true;
  if (data.lat && data.lon) {
    const d = distanceMeters(loc, {
      latitude: parseFloat(data.lat),
      longitude: parseFloat(data.lon),
    });
    closeEnough = d <= 150;
  }
  const full = buildFullAddress(data);
  if (hasStreet && closeEnough && full) {
    return { label: full, precise: true };
  }
  // Imprécis → étiquette de zone honnête (pas de fausse rue).
  const area =
    buildAreaLabel(data) ||
    (data.display_name ?? '').split(',').slice(0, 2).join(',').trim();
  return area ? { label: area, precise: false } : null;
}

/**
 * Reverse-geocode robuste pour "Ma position actuelle" / carte / lien partagé.
 *
 * Stratégie (du plus fiable au plus permissif) :
 *  1. Natif (Apple/Google) : adresse DU point exact. Si rue précise → on prend.
 *  2. Nominatim avec validation de distance (rejette une rue à >150 m).
 *  3. Repli sur la meilleure étiquette de ZONE (quartier, ville) — honnête,
 *     plutôt qu'une rue voisine fausse. La coordonnée GPS exacte reste, elle,
 *     toujours conservée par l'appelant (le livreur va au bon point).
 */
export async function reverseGeocode(location: LatLng): Promise<string | null> {
  const native = await nativeReverse(location);
  if (native?.precise) return native.label;

  const nom = await nominatimReverse(location);
  if (nom?.precise) return nom.label;

  // Aucune adresse précise fiable : meilleure étiquette de zone dispo.
  return native?.label || nom?.label || null;
}

/**
 * Construit une adresse detaillee à partir d'une reponse Nominatim reverse.
 * Exemple: "Rue 10.74, Secteur 15, Dassasgho, Ouagadougou"
 */
function buildFullAddress(d: {
  display_name?: string;
  address?: Record<string, string>;
}): string {
  const a = d.address ?? {};
  const parts: string[] = [];

  // Numéro de maison + rue si disponibles
  const street = a.road || a.pedestrian || a.footway || a.residential;
  if (street) {
    if (a.house_number) {
      parts.push(`${a.house_number} ${street}`);
    } else {
      parts.push(street);
    }
  } else if (a.amenity || a.building || a.shop || a.office || a.tourism) {
    parts.push(a.amenity || a.building || a.shop || a.office || a.tourism!);
  }

  // Quartier / secteur
  const sector = a.neighbourhood || a.suburb || a.city_district || a.district;
  if (sector && !parts.includes(sector)) parts.push(sector);

  // Ville
  const city = a.city || a.town || a.village || a.municipality;
  if (city && !parts.includes(city)) parts.push(city);

  // Au moins 2 elements pour considerer que c'est "complet"
  if (parts.length < 2) {
    return '';
  }
  return parts.join(', ');
}

function buildShortName(d: {
  display_name?: string;
  address?: Record<string, string>;
}): string {
  const a = d.address ?? {};
  const parts: string[] = [];

  const primary =
    a.amenity ||
    a.building ||
    a.shop ||
    a.office ||
    a.tourism ||
    a.public_building ||
    a.leisure ||
    a.road ||
    a.pedestrian ||
    a.neighbourhood ||
    a.suburb;

  if (primary) parts.push(primary);

  const area = a.suburb || a.neighbourhood || a.city_district || a.district;
  if (area && area !== primary) parts.push(area);

  const city = a.city || a.town || a.village;
  if (city) parts.push(city);

  if (parts.length === 0) {
    const display = d.display_name ?? '';
    return display.split(',').slice(0, 3).join(',').trim();
  }

  return parts.join(', ');
}
