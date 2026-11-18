/**
 * Socle cookie admin (compat ascendante) — logique PURE, sans prisma ni env,
 * pour rester testable sans DB (cf. matching-diagnostics.ts).
 *
 * Objectif : le middleware auth accepte le token d'accès depuis
 *   1) le header `Authorization: Bearer <token>` (PRIORITAIRE — rien ne change
 *      pour l'admin/mobile qui envoient déjà le header), OU
 *   2) un cookie HttpOnly `toole_admin_token` (fallback, non requis).
 *
 * Tant que le header continue d'être envoyé, le cookie n'est jamais utilisé :
 * la bascule (retirer le header côté admin + poser CORS_ORIGIN) se fera plus
 * tard. Aucun risque introduit par ce socle.
 */

/** Nom du cookie HttpOnly portant l'access token admin. */
export const ACCESS_COOKIE_NAME = 'toole_admin_token';

/**
 * Extrait l'access token : header Bearer prioritaire, sinon cookie.
 * Rend null si aucun des deux n'est exploitable.
 */
export function extractAuthToken(
  authHeader: string | undefined,
  cookies: Record<string, string | undefined> | undefined,
  cookieName: string = ACCESS_COOKIE_NAME,
): string | null {
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const t = authHeader.slice('Bearer '.length).trim();
    if (t) return t;
  }
  const c = cookies?.[cookieName];
  if (c && c.trim()) return c.trim();
  return null;
}

export interface AccessCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
  maxAge?: number;
}

/**
 * Options du cookie d'access token.
 * - PROD : `Secure` + `SameSite=None` obligatoires car admin et API sont sur
 *   deux sous-domaines (admin-toole vs api.toole) → cookie cross-site.
 * - DEV : `SameSite=Lax` sans `Secure` pour rester utilisable en http://localhost.
 */
export function accessCookieOptions(
  isProd: boolean,
  maxAgeMs?: number,
): AccessCookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    ...(maxAgeMs != null ? { maxAge: maxAgeMs } : {}),
  };
}

/**
 * Convertit une durée type "15m" / "1h" / "30d" / "900" (secondes) en ms.
 * Rend `fallbackMs` si le format n'est pas reconnu.
 */
export function durationToMs(duration: string, fallbackMs: number): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const mult =
      unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return value * mult * 1000;
  }
  if (/^\d+$/.test(duration)) return parseInt(duration, 10) * 1000;
  return fallbackMs;
}
