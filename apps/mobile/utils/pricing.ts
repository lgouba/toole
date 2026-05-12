import { PackageType, PriceEstimate } from '@/types';
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Calcule le prix estimé d'une livraison côté mobile.
 *
 * Les valeurs (base, km, commission) sont lues depuis le `settingsStore`
 * synchronise avec l'admin via `/api/settings`. Refresh automatique toutes les
 * 5 min + au démarrage de l'app. Le backend reste source de verite lors de la
 * création reelle de la livraison.
 */
export function calculatePrice(
  packageType: PackageType,
  distanceKm: number,
): PriceEstimate {
  const { pricing } = useSettingsStore.getState().settings;

  const basePrice =
    packageType === 'envelope'
      ? pricing.basePriceEnvelope
      : packageType === 'small'
        ? pricing.basePriceSmall
        : pricing.basePriceLarge;

  const distancePrice = Math.ceil(distanceKm) * pricing.pricePerKm;
  const price = Math.max(basePrice, basePrice + distancePrice);
  const platformFee = Math.round(price * (pricing.platformCommissionPct / 100));
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
