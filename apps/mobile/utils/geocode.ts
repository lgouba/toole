import { LatLng } from '@/types';

export interface GeocodeSuggestion {
  location: LatLng;
  displayName: string;
  shortName: string;
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
  }));
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
  return buildShortName(data) || data.display_name || null;
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
