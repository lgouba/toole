import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * URLs signées pour les fichiers KYC (pièces d'identité, permis, véhicule).
 *
 * Problème : les photos KYC sont affichées par des balises <img>/<Image> (admin +
 * app livreur) qui ne peuvent pas envoyer de header d'Authorization. On ne peut
 * donc pas simplement mettre le dossier derrière un middleware Bearer.
 *
 * Solution : le serveur signe l'URL (HMAC sur chemin+expiration) au moment où il
 * la RENVOIE (upload, /drivers/me/kyc, détail admin). Un middleware valide la
 * signature avant de servir le fichier. Le chemin canonique (sans query) reste
 * ce qui est STOCKÉ en base ; la signature est éphémère et recalculée à lecture.
 */

const SECRET = env.JWT_ACCESS_SECRET; // secret serveur déjà garanti fort en prod
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 h : large pour une session admin / KYC

/** Vrai si ce chemin/URL pointe vers un fichier KYC (à protéger). */
export function isKycPath(value: string | null | undefined): boolean {
  if (!value) return false;
  const path = canonicalUploadPath(value);
  return path.startsWith('/uploads/kyc/');
}

/** Retire toute query (?exp&sig) pour revenir au chemin canonique stockable. */
export function canonicalUploadPath(value: string): string {
  // Gère les chemins relatifs ("/uploads/kyc/x.jpg?..") comme les absolus.
  const q = value.indexOf('?');
  return q === -1 ? value : value.slice(0, q);
}

function computeSig(path: string, exp: number): string {
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${path}|${exp}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Signe une URL KYC (chemin relatif "/uploads/kyc/..."). Renvoie l'URL avec
 * `?exp=…&sig=…`. Les valeurs non-KYC (avatars, packages, null, http externe)
 * sont renvoyées telles quelles.
 */
export function signKycUrl(
  value: string | null | undefined,
  ttlMs: number = DEFAULT_TTL_MS,
): string | null | undefined {
  if (!value || !isKycPath(value)) return value;
  const path = canonicalUploadPath(value);
  const exp = Date.now() + ttlMs;
  const sig = computeSig(path, exp);
  return `${path}?exp=${exp}&sig=${sig}`;
}

/** Valide la signature d'un accès fichier KYC (query exp+sig sur ce path). */
export function verifyKycSignature(
  path: string,
  exp?: string,
  sig?: string,
): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  const expected = computeSig(path, expNum);
  // Comparaison à temps constant.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Champs KYC connus à signer sur un objet de réponse (driverProfile / user). */
const KYC_FIELDS = [
  'cnibPhotoUrl',
  'cnibPhotoBackUrl',
  'licensePhotoUrl',
  'vehiclePhotoUrl',
] as const;

/**
 * Renvoie une COPIE de l'objet (ou de son `driverProfile` imbriqué) avec les
 * champs KYC signés. Ne mute pas l'entrée. Sûr si l'objet est null.
 */
export function signKycFields<T extends Record<string, unknown> | null | undefined>(
  obj: T,
): T {
  if (!obj || typeof obj !== 'object') return obj;
  const clone: Record<string, unknown> = { ...obj };
  for (const f of KYC_FIELDS) {
    if (typeof clone[f] === 'string') clone[f] = signKycUrl(clone[f] as string);
  }
  // driverProfile imbriqué (réponses user/admin).
  const dp = clone.driverProfile;
  if (dp && typeof dp === 'object') {
    const dpClone: Record<string, unknown> = { ...(dp as Record<string, unknown>) };
    for (const f of KYC_FIELDS) {
      if (typeof dpClone[f] === 'string')
        dpClone[f] = signKycUrl(dpClone[f] as string);
    }
    clone.driverProfile = dpClone;
  }
  return clone as T;
}

/** Canonicalise les champs KYC (retire les query) avant stockage en base. */
export function canonicalizeKycFields<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  for (const f of KYC_FIELDS) {
    if (typeof out[f] === 'string') out[f] = canonicalUploadPath(out[f] as string);
  }
  return out as T;
}
