import { PackageSize, PackageType, PriceEstimate } from '@/types';
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Calcule le prix estime d'une livraison cote mobile.
 *
 * Les valeurs (base, km, commission) sont lues depuis le `settingsStore`
 * synchronise avec l'admin via `/api/settings`. Refresh automatique toutes les
 * 5 min + au demarrage. Le backend reste source de verite lors de la creation
 * reelle de la livraison.
 *
 * @param packageType  ancien type de colis (fallback compat)
 * @param distanceKm   distance vol-d'oiseau en km
 * @param packageSize  nouvelle taille (Bundle 2). Si fournie, prend le pas sur
 *                     packageType pour le prix de base.
 */
export function calculatePrice(
  packageType: PackageType,
  distanceKm: number,
  packageSize?: PackageSize,
): PriceEstimate {
  const { pricing } = useSettingsStore.getState().settings;

  // Resoud la taille effective (Bundle 2) avec fallback sur packageType.
  const size: PackageSize = packageSize
    ? packageSize
    : packageType === 'envelope'
      ? 'small'
      : packageType === 'small'
        ? 'medium'
        : 'large';

  const basePrice =
    size === 'small'
      ? pricing.basePriceSmall
      : size === 'medium'
        ? (pricing.basePriceMedium ?? pricing.basePriceSmall)
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
