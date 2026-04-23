import { LatLng } from '@/types';

export interface GeocodeSuggestion {
  location: LatLng;
  displayName: string;
  shortName: string;
  /**
   * true si la suggestion pointe vers une adresse precise (rue, numero,
   * batiment) plutot qu'une zone large (ville, departement). Utilise pour
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

/**
 * Recherche des adresses pour l'autocompletion.
 * Biaisee vers le Burkina Faso. Retourne plusieurs resultats.
 */
export async function searchAddresses(
  query: string,
  biasLocation?: LatLng,
): Promise<GeocodeSuggestion[]> {
  if (!query || query.trim().length < 3) return [];

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    limit: '6',
    countrycodes: 'bf',
    'accept-language': 'fr',
    addressdetails: '1',
  });

  if (biasLocation) {
    const { latitude, longitude } = biasLocation;
    const delta = 0.2;
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
 * un numero de maison, une rue, un batiment / commerce / amenity.
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

export async function reverseGeocode(location: LatLng): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    format: 'json',
    'accept-language': 'fr',
    zoom: '18',
    addressdetails: '1',
  });

  const data = await fetchJson<{
    display_name?: string;
    address?: Record<string, string>;
  }>(`${NOMINATIM_BASE}/reverse?${params}`);

  if (!data) return null;
  // Pour un reverse-geocode (ex. "Ma position actuelle"), on veut une adresse
  // la plus complete possible : numero + rue + quartier + ville.
  return buildFullAddress(data) || buildShortName(data) || data.display_name || null;
}

/**
 * Construit une adresse detaillee a partir d'une reponse Nominatim reverse.
 * Exemple: "Rue 10.74, Secteur 15, Dassasgho, Ouagadougou"
 */
function buildFullAddress(d: {
  display_name?: string;
  address?: Record<string, string>;
}): string {
  const a = d.address ?? {};
  const parts: string[] = [];

  // Numero de maison + rue si disponibles
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
