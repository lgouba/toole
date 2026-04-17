import { PackageType, PriceEstimate } from '@/types';

const BASE_PRICES: Record<PackageType, number> = {
  envelope: 300,
  small: 500,
  large: 1000,
};

const PRICE_PER_KM = 100;
const PLATFORM_FEE_RATE = 0.15;

export function calculatePrice(packageType: PackageType, distanceKm: number): PriceEstimate {
  const basePrice = BASE_PRICES[packageType];
  const distancePrice = Math.ceil(distanceKm) * PRICE_PER_KM;
  const price = Math.max(basePrice, basePrice + distancePrice);
  const platformFee = Math.round(price * PLATFORM_FEE_RATE);
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
