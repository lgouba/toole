import { logger } from './logger.js';

/**
 * Helper OSRM : calcule un itineraire routier reel entre deux points
 * (geometrie complete qui suit les rues + duree + distance).
 *
 * En prod on pointe sur une instance OSRM auto-hebergee (gratuite, illimitee)
 * via OSRM_BASE_URL (cf. docker-compose : service `tolle-osrm`). A defaut, on
 * retombe sur l'instance publique de demo (rate-limitee, NE PAS utiliser en
 * prod serieuse).
 *
 * Cache en memoire (TTL 15s par cle, arrondi ~11m) pour ne pas marteler OSRM
 * lors des pollings clients/livreurs (rafraichissement ~5s). Une seule requete
 * OSRM sert a la fois la geometrie ET l'ETA (meme appel `overview=full`).
 */

const OSRM_BASE = process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org';
const CACHE_TTL_MS = 15_000;
const FETCH_TIMEOUT_MS = 4_000;

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  /** Duree estimee en secondes pour parcourir le trajet en voiture. */
  durationSeconds: number;
  /** Distance reelle de la route en metres (peut differer du vol-d'oiseau). */
  distanceMeters: number;
  /** Geometrie du trajet (suit les rues), du depart vers l'arrivee. */
  coordinates: RoutePoint[];
}

/** Sous-ensemble historique (ETA seul). Conserve pour compat des callers. */
export interface EtaResult {
  durationSeconds: number;
  distanceMeters: number;
}

interface CacheEntry {
  value: RouteResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): string {
  // Arrondi a 4 decimales (~11m) pour qu'un GPS qui bouge un peu reutilise
  // tout de meme le cache. Pas plus large pour ne pas masquer un vrai mouvement.
  const r = (n: number) => n.toFixed(4);
  return `${r(fromLat)},${r(fromLng)}->${r(toLat)},${r(toLng)}`;
}

/**
 * Calcule l'itineraire routier complet (geometrie + ETA) entre deux points GPS.
 * Retourne null si l'API ne repond pas ou retourne une erreur (le caller doit
 * gerer le fallback : typiquement, tracer une ligne directe a la place).
 */
export async function computeRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<RouteResult | null> {
  const key = cacheKey(fromLat, fromLng, toLat, toLng);
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  // OSRM coords format : "lng,lat;lng,lat". overview=full + geometries=geojson
  // => geometrie detaillee qui suit les rues (tableau de [lng,lat]).
  const url =
    `${OSRM_BASE.replace(/\/+$/, '')}/route/v1/driving/` +
    `${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn({ status: res.status, url }, 'OSRM HTTP error');
      return null;
    }
    const json = (await res.json()) as {
      code?: string;
      routes?: Array<{
        duration: number;
        distance: number;
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };
    if (json.code !== 'Ok' || !json.routes || json.routes.length === 0) {
      logger.warn({ code: json.code }, 'OSRM returned no route');
      return null;
    }
    const route = json.routes[0];
    const coords = route.geometry?.coordinates ?? [];
    const result: RouteResult = {
      durationSeconds: Math.round(route.duration),
      distanceMeters: Math.round(route.distance),
      // GeoJSON = [lng, lat] -> on expose { latitude, longitude }
      coordinates: coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
    };
    cache.set(key, { value: result, expiresAt: now + CACHE_TTL_MS });

    // Garde le cache borne (max 500 entrees, drop les plus anciennes).
    if (cache.size > 500) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }

    return result;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      logger.warn({ url }, 'OSRM request timed out');
    } else {
      logger.warn({ err: err?.message ?? String(err) }, 'OSRM request failed');
    }
    return null;
  }
}

/**
 * Calcule l'ETA seul entre deux points (reutilise le meme cache/appel que
 * computeRoute). Retourne null en cas d'echec (le caller cache l'ETA dans l'UI).
 */
export async function computeRouteEta(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<EtaResult | null> {
  const r = await computeRoute(fromLat, fromLng, toLat, toLng);
  if (!r) return null;
  return { durationSeconds: r.durationSeconds, distanceMeters: r.distanceMeters };
}
