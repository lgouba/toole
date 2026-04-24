import { LatLng } from '@/types';

/**
 * Parse une URL de localisation (WhatsApp, Google Maps, Apple Maps, etc.)
 * et extrait les coordonnees lat/lng.
 *
 * Formats supportes:
 * - https://maps.google.com/?q=12.3714,-1.5197
 * - https://www.google.com/maps/search/?api=1&query=12.3714,-1.5197
 * - https://maps.google.com/maps?q=loc:12.3714,-1.5197
 * - https://maps.google.com/maps?ll=12.3714,-1.5197
 * - https://www.google.com/maps/@12.3714,-1.5197,15z
 * - geo:12.3714,-1.5197
 * - https://maps.apple.com/?ll=12.3714,-1.5197
 * - Texte brut: "12.3714, -1.5197"
 */
export function parseLocationUrl(input: string): LatLng | null {
  if (!input) return null;

  const trimmed = input.trim();

  // Regex pour lat/lng (positif ou negatif avec decimales)
  const coordRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;

  // 1. Essai: texte brut "lat, lng"
  const plainMatch = trimmed.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (plainMatch) {
    return {
      latitude: parseFloat(plainMatch[1]),
      longitude: parseFloat(plainMatch[2]),
    };
  }

  // 2. Essai: geo:lat,lng
  const geoMatch = trimmed.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (geoMatch) {
    return {
      latitude: parseFloat(geoMatch[1]),
      longitude: parseFloat(geoMatch[2]),
    };
  }

  // 3. Essai: Google Maps query param (q=, ll=, query=)
  const paramMatch = trimmed.match(/[?&](?:q|ll|query|center)=(?:loc:)?(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (paramMatch) {
    return {
      latitude: parseFloat(paramMatch[1]),
      longitude: parseFloat(paramMatch[2]),
    };
  }

  // 4. Essai: Google Maps /@lat,lng format
  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return {
      latitude: parseFloat(atMatch[1]),
      longitude: parseFloat(atMatch[2]),
    };
  }

  // 5. Fallback: premiere paire lat,lng trouvee dans la chaine
  const anyMatch = trimmed.match(coordRegex);
  if (anyMatch) {
    const lat = parseFloat(anyMatch[1]);
    const lng = parseFloat(anyMatch[2]);
    // Validation basique (lat: -90..90, lng: -180..180)
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}

/**
 * Indique si une URL courte (goo.gl, maps.app.goo.gl) doit etre resolue.
 * Les liens courts necessitent une resolution réseau - retourne true pour afficher un message.
 */
export function isShortLocationUrl(input: string): boolean {
  const trimmed = input.trim();
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/.test(trimmed);
}
