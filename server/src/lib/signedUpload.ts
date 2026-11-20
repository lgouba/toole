import crypto from 'node:crypto';
import path from 'node:path';
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

/**
 * Normalise un chemin d'URL EXACTEMENT comme `express.static`/`send` le
 * résoudra réellement sur le disque, pour décider de la garde KYC AVANT la
 * servie statique. Sans ça, une garde montée en préfixe (`/uploads/kyc`) peut
 * être sautée par une forme d'URL que le static normalise quand même vers un
 * fichier KYC (`/uploads//kyc/x`, `/uploads/kyc%2fx`, `/uploads/./kyc/x`…),
 * ce qui servirait la pièce d'identité sans signature valide.
 *
 * Réplique ce que `send` fait : un décodage %xx (une seule passe), puis
 * effondrement des slashes multiples, puis normalisation POSIX (résout `.`/`..`).
 * En cas de séquence % invalide, on garde la chaîne telle quelle (send
 * rejetterait l'accès de toute façon) ; la garde doit alors être conservatrice.
 */
export function normalizeServedUploadPath(rawPath: string): string {
  const q = rawPath.indexOf('?');
  let p = q === -1 ? rawPath : rawPath.slice(0, q);
  try {
    p = decodeURIComponent(p);
  } catch {
    // Séquence % invalide : on ne décode pas. `send` renverra une erreur, mais
    // on ne doit pas « rater » un chemin KYC pour autant.
  }
  // Effondre les slashes multiples (`//` → `/`) puis résout `.`/`..`.
  p = p.replace(/\/{2,}/g, '/');
  p = path.posix.normalize(p);
  return p;
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

/**
 * Décision de servie pour une requête vers `/uploads`, appliquée AVANT
 * `express.static`. La garde KYC opère sur le chemin NORMALISÉ (cf.
 * normalizeServedUploadPath) : impossible de la contourner avec une forme
 * d'URL exotique (`//kyc`, `kyc%2f`, `./kyc`, `..`) qui résout quand même vers
 * un fichier KYC. Renvoie true si l'accès est autorisé (fichier public
 * avatars/packages, ou KYC avec signature `?exp&sig` valide et non expirée),
 * false si le serveur doit répondre 403.
 *
 * @param servedPath chemin complet de style `/uploads/...` (query possible)
 */
export function isUploadAccessAllowed(
  servedPath: string,
  exp?: string,
  sig?: string,
): boolean {
  const normalized = normalizeServedUploadPath(servedPath);
  // Seuls les KYC sont protégés ; avatars/packages restent publics.
  if (!normalized.startsWith('/uploads/kyc/')) return true;
  // La signature est calculée sur le chemin canonique `/uploads/kyc/<fichier>`
  // (cf. signKycUrl) ; le chemin normalisé lui est égal, d'où le match.
  return verifyKycSignature(normalized, exp, sig);
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
