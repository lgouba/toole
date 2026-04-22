import { useMemo } from 'react';
import { LatLng, PackageType, PriceEstimate } from '@/types';
import { haversineDistance } from '@/utils/geo';
import { calculatePrice } from '@/utils/pricing';
import { useSettingsStore } from '@/stores/settings.store';

export function useDeliveryPrice(
  packageType?: PackageType,
  pickupLocation?: LatLng,
  deliveryLocation?: LatLng,
): PriceEstimate | null {
  // Souscrit au pricing pour que le hook se re-render automatiquement
  // quand l'admin modifie les tarifs (refresh auto toutes les 5 min).
  const pricing = useSettingsStore((s) => s.settings.pricing);

  return useMemo(() => {
    if (!packageType || !pickupLocation || !deliveryLocation) return null;
    const distance = haversineDistance(pickupLocation, deliveryLocation);
    return calculatePrice(packageType, distance);
  }, [
    packageType,
    pickupLocation?.latitude,
    pickupLocation?.longitude,
    deliveryLocation?.latitude,
    deliveryLocation?.longitude,
    // Recalcul si les tarifs changent
    pricing.basePriceEnvelope,
    pricing.basePriceSmall,
    pricing.basePriceLarge,
    pricing.pricePerKm,
    pricing.platformCommissionPct,
  ]);
}
