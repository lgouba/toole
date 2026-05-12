import { logger } from './logger.js';

/**
 * Helper OSRM pour calculer un ETA (temps d'arrivee estime) entre deux points
 * en suivant la route routiere reelle.
 *
 * Utilise par defaut l'instance publique de demonstration OSRM, qui est
 * gratuite mais rate-limitee. Pour la prod, deployer sa propre instance
 * (https://github.com/Project-OSRM/osrm-backend) et pointer dessus via
 * OSRM_BASE_URL.
 *
 * Cache en memoire (TTL 15s par cle) pour eviter de hammer OSRM lors des
 * pollings clients/livreurs (rafraichissement toutes les 5s).
 */

const OSRM_BASE = process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org';
const CACHE_TTL_MS = 15_000;
const FETCH_TIMEOUT_MS = 4_000;

export interface EtaResult {
  /** Duree estimee en secondes pour parcourir le trajet en voiture. */
  durationSeconds: number;
  /** Distance reelle de la route en metres (peut differer du vol-d'oiseau). */
  distanceMeters: number;
}

interface CacheEntry {
  value: EtaResult;
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
 * Calcule l'ETA entre deux points GPS. Retourne null si l'API ne repond pas
 * ou retourne une erreur (le caller doit gerer le fallback proprement —
 * typiquement, masquer l'ETA dans l'UI).
 */
export async function computeRouteEta(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<EtaResult | null> {
  const key = cacheKey(fromLat, fromLng, toLat, toLng);
  const now = Date.now();

  // Cache hit
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  // OSRM coords format : "lng,lat;lng,lat"
  const url = `${OSRM_BASE.replace(/\/+$/, '')}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false&alternatives=false&steps=false`;

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
      routes?: Array<{ duration: number; distance: number }>;
    };
    if (json.code !== 'Ok' || !json.routes || json.routes.length === 0) {
      logger.warn({ code: json.code }, 'OSRM returned no route');
      return null;
    }
    const route = json.routes[0];
    const result: EtaResult = {
      durationSeconds: Math.round(route.duration),
      distanceMeters: Math.round(route.distance),
    };
    cache.set(key, { value: result, expiresAt: now + CACHE_TTL_MS });

    // Garde le cache borne (max 500 entrees, drop les plus anciennes en LRU
    // approximatif via insertion order).
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
