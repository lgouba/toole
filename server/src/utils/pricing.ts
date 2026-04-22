import { PackageType } from '@prisma/client';
import { getAppSettings } from '../services/settings.service.js';

export interface PriceBreakdown {
  price: number;
  distanceKm: number;
  basePrice: number;
  distancePrice: number;
  platformFee: number;
  driverCommission: number;
}

/**
 * Calcule le prix d'une livraison en fonction du type de colis et de la distance.
 * Les valeurs (prix de base par type, prix au km, commission) viennent de la
 * table AppSettings, modifiable depuis l'admin. Un cache 30s evite de hit la
 * DB a chaque estimation.
 */
export async function calculatePrice(
  packageType: PackageType,
  distanceKm: number,
): Promise<PriceBreakdown> {
  const s = await getAppSettings();

  const basePrice =
    packageType === 'envelope'
      ? s.basePriceEnvelope
      : packageType === 'small'
        ? s.basePriceSmall
        : s.basePriceLarge;

  const distancePrice = Math.ceil(distanceKm) * s.pricePerKm;
  const price = Math.max(basePrice, basePrice + distancePrice);
  const platformFee = Math.round(price * (s.platformCommissionPct / 100));
  const driverCommission = price - platformFee;

  return {
    price,
    distanceKm: Math.round(distanceKm * 10) / 10,
    basePrice,
    distancePrice,
    platformFee,
    driverCommission,
  };
}
