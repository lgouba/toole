import { PackageSize, PackageType } from '@prisma/client';
import { getAppSettings, isNightTime } from '../services/settings.service.js';

export interface PriceBreakdown {
  price: number;
  distanceKm: number;
  basePrice: number;
  distancePrice: number;
  /** Montant additionnel pour le tarif de nuit (0 si pas applique). */
  nightSurcharge: number;
  /** True si la course a ete calculee avec un tarif de nuit. */
  isNightTime: boolean;
  platformFee: number;
  driverCommission: number;
}

/**
 * Determine la taille effective pour le calcul de prix :
 *   - Si packageSize est fourni (nouveau form Bundle 2+), on l'utilise.
 *   - Sinon, fallback sur packageType (pour anciennes courses pre-migration) :
 *       envelope -> small, small -> medium (par defaut), large -> large.
 */
function resolveSize(
  packageSize: PackageSize | null | undefined,
  packageType: PackageType,
): PackageSize {
  if (packageSize) return packageSize;
  if (packageType === 'envelope') return 'small';
  if (packageType === 'small') return 'medium';
  return 'large';
}

/**
 * Calcule le prix d'une livraison.
 *
 * Le prix de base depend de la TAILLE du colis (PackageSize), pas de la
 * categorie (PackageCategory) qui est juste une metadonnee pour le livreur.
 *
 * @param packageType  ancien type de colis (compat ascendante)
 * @param distanceKm   distance vol-d'oiseau en km
 * @param at           date a laquelle la course doit etre evaluee (defaut: now)
 * @param packageSize  nouvelle taille du colis (optionnel, recommande). Si
 *                     fournie, prend le pas sur packageType pour le prix de
 *                     base.
 */
export async function calculatePrice(
  packageType: PackageType,
  distanceKm: number,
  at: Date = new Date(),
  packageSize?: PackageSize | null,
): Promise<PriceBreakdown> {
  const s = await getAppSettings();
  const size = resolveSize(packageSize, packageType);

  // Prix de base par taille
  const basePrice =
    size === 'small'
      ? s.basePriceSmall
      : size === 'medium'
        ? s.basePriceMedium
        : s.basePriceLarge;

  const distancePrice = Math.ceil(distanceKm) * s.pricePerKm;

  // Tarif de nuit (montant fixe additionnel)
  let nightSurcharge = 0;
  let inNight = false;
  if (s.nightSurchargeEnabled && s.nightSurchargeAmount > 0) {
    inNight = isNightTime(at, s.nightSurchargeStartHour, s.nightSurchargeEndHour);
    if (inNight) nightSurcharge = s.nightSurchargeAmount;
  }

  const subtotal = Math.max(basePrice, basePrice + distancePrice);
  const price = subtotal + nightSurcharge;
  // Commission plateforme sur le subtotal uniquement. La majoration de nuit
  // revient integralement au livreur (incite a accepter les courses tardives).
  const platformFee = Math.round(subtotal * (s.platformCommissionPct / 100));
  const driverCommission = price - platformFee;

  return {
    price,
    distanceKm: Math.round(distanceKm * 10) / 10,
    basePrice,
    distancePrice,
    nightSurcharge,
    isNightTime: inNight,
    platformFee,
    driverCommission,
  };
}
