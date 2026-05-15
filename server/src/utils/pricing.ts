import { PackageType } from '@prisma/client';
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
 * Calcule le prix d'une livraison en fonction du type de colis et de la distance.
 * Les valeurs (prix de base par type, prix au km, commission) viennent de la
 * table AppSettings, modifiable depuis l'admin. Un cache 30s evite de hit la
 * DB a chaque estimation.
 *
 * @param packageType  type de colis
 * @param distanceKm   distance vol-d'oiseau en km
 * @param at           date a laquelle la course doit etre evaluee (defaut: now).
 *                     Utile pour les courses programmees : le tarif de nuit
 *                     applique est celui de l'heure prevue, pas l'heure de
 *                     creation.
 */
export async function calculatePrice(
  packageType: PackageType,
  distanceKm: number,
  at: Date = new Date(),
): Promise<PriceBreakdown> {
  const s = await getAppSettings();

  const basePrice =
    packageType === 'envelope'
      ? s.basePriceEnvelope
      : packageType === 'small'
        ? s.basePriceSmall
        : s.basePriceLarge;

  const distancePrice = Math.ceil(distanceKm) * s.pricePerKm;

  // Tarif de nuit : montant additionnel fixe, applique si l'heure est dans
  // la plage configuree ET que le toggle est actif ET que le montant > 0.
  let nightSurcharge = 0;
  let inNight = false;
  if (s.nightSurchargeEnabled && s.nightSurchargeAmount > 0) {
    inNight = isNightTime(at, s.nightSurchargeStartHour, s.nightSurchargeEndHour);
    if (inNight) {
      nightSurcharge = s.nightSurchargeAmount;
    }
  }

  const subtotal = Math.max(basePrice, basePrice + distancePrice);
  const price = subtotal + nightSurcharge;
  // La commission plateforme est calculee sur le subtotal uniquement.
  // La majoration de nuit revient integralement au livreur (incitation a
  // accepter les courses tardives).
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
