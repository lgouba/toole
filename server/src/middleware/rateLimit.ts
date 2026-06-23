import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../lib/logger.js';

/**
 * Limiters HTTP pour prevenir les abus :
 *   - Spam d'OTP (drain le credit Africa's Talking)
 *   - Brute-force du login admin
 *   - Brute-force des codes promo
 *   - DDoS basique
 *
 * Tous les limiters retournent du 429 + un JSON cohérent avec le format
 * d'erreur de l'app : { error: { code: 'RATE_LIMITED', message: '...' } }.
 *
 * Note : le serveur tourne derriere nginx-proxy, donc `app.set('trust proxy', 1)`
 * est requis dans index.ts pour que req.ip retourne la vraie IP du client
 * (sinon tout le monde a l'IP du proxy = limiter inutile).
 */

function tooManyResponse(message: string) {
  return (req: Request, res: Response) => {
    logger.warn(
      { ip: req.ip, path: req.path, ua: req.headers['user-agent'] },
      'Rate limit hit',
    );
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message,
      },
    });
  };
}

/**
 * Limit envois d'OTP par numero de telephone.
 * Max 5 demandes par numero par tranche de 10 minutes.
 *
 * Le numero est extrait du body de la requete. Si absent, on retombe sur l'IP.
 */
export const otpByPhoneLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const phone = (req.body?.phone ?? '').toString().replace(/\D/g, '');
    if (phone) return `phone:${phone}`;
    return ipKeyGenerator(req.ip ?? 'unknown');
  },
  handler: tooManyResponse(
    'Trop de demandes de code pour ce numéro. Réessayez dans 10 minutes.',
  ),
});

/**
 * Limit envois d'OTP par IP (anti-distribution).
 * Max 30 demandes par IP par tranche de 10 minutes.
 *
 * Couvre le cas ou un attaquant utilise plusieurs numeros depuis la meme IP.
 */
export const otpByIpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyResponse(
    'Trop de demandes depuis votre connexion. Réessayez dans 10 minutes.',
  ),
});

/**
 * Anti-brute-force de l'OTP (verify-otp + register). Le code ne fait que 4
 * chiffres (10 000 combinaisons) : sans limiter dédié, le globalLimiter (200/min)
 * laisserait épuiser l'espace. Max 8 essais par identifiant (téléphone/email)
 * par tranche de 15 min ; fallback IP si l'identifiant est absent.
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const raw = (
      req.body?.identifier ??
      req.body?.phone ??
      req.body?.email ??
      ''
    )
      .toString()
      .trim()
      .toLowerCase();
    if (raw) return `otp:${raw.replace(/\s+/g, '')}`;
    return ipKeyGenerator(req.ip ?? 'unknown');
  },
  handler: tooManyResponse(
    'Trop de tentatives de code. Réessayez dans 15 minutes.',
  ),
});

/**
 * Limit de l'upload KYC PUBLIC (sans auth, utilisé pendant l'inscription
 * livreur). Sans ça, un attaquant peut saturer le disque. Max 15 envois par IP
 * par heure ; ne s'applique qu'à la catégorie `kyc` (les autres sont protégées
 * par l'auth).
 */
export const kycUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => (req.params as { category?: string }).category !== 'kyc',
  handler: tooManyResponse(
    "Trop d'envois de documents. Réessayez dans une heure.",
  ),
});

/**
 * Limit pour brute-force du login admin (mot de passe).
 * Max 10 tentatives par IP par 15 min.
 */
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyResponse(
    'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  ),
});

/**
 * Limit pour brute-force des codes promo.
 * Max 20 tentatives de code promo par IP par 5 min.
 */
export const promoLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyResponse(
    'Trop de tentatives de code promo. Réessayez dans 5 minutes.',
  ),
});

/**
 * Limit global anti-DDoS basique.
 * Max 200 requetes par IP par minute.
 *
 * Tres permissif pour un usage normal (un client mobile fait environ 10-20 req/min),
 * mais coupe net un script abusif.
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  // On skip pour les endpoints internes de health-check
  skip: (req: Request) => req.path === '/health' || req.path === '/api/health',
  handler: tooManyResponse(
    'Trop de requêtes. Patientez un instant puis réessayez.',
  ),
});
