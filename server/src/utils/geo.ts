import crypto from 'node:crypto';

/**
 * Haversine distance (in kilometers) between two lat/lng points.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Generate a 4 digit validation code (string). CSPRNG (crypto), pas Math.random. */
export function generateValidationCode(): string {
  return crypto.randomInt(1000, 10000).toString();
}

/** Generate a delivery reference like TOL-YYYYMMDD-XXXX. */
export function generateReference(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = crypto.randomInt(1000, 10000);
  return `TOL-${yyyy}${mm}${dd}-${rand}`;
}

/**
 * Token de suivi public (12 caracteres alphanum lowercase).
 * Non devinable brute-force : ~36^12 = 4.7×10^18 combinaisons.
 * Sert pour la page /track/:token partagee au destinataire.
 */
export function generateTrackingToken(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    // crypto.randomInt = CSPRNG : token imprévisible (vs Math.random prévisible).
    token += alphabet[crypto.randomInt(alphabet.length)];
  }
  return token;
}
