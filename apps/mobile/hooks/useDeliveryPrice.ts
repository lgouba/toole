import { useMemo } from 'react';
import { LatLng, PackageType, PriceEstimate } from '@/types';
import { haversineDistance } from '@/utils/geo';
import { calculatePrice } from '@/utils/pricing';

export function useDeliveryPrice(
  packageType?: PackageType,
  pickupLocation?: LatLng,
  deliveryLocation?: LatLng
): PriceEstimate | null {
  return useMemo(() => {
    if (!packageType || !pickupLocation || !deliveryLocation) return null;
    const distance = haversineDistance(pickupLocation, deliveryLocation);
    return calculatePrice(packageType, distance);
  }, [packageType, pickupLocation?.latitude, pickupLocation?.longitude, deliveryLocation?.latitude, deliveryLocation?.longitude]);
}
