import { LatLng } from './user';

export type PackageType = 'envelope' | 'small' | 'large';

export type DeliveryStatus =
  | 'scheduled'
  | 'pending'
  | 'accepted'
  | 'picking_up'
  | 'picked_up'
  | 'delivering'
  | 'delivered'
  | 'cancelled'
  | 'expired';

export interface Address {
  address: string;
  details?: string;
  location: LatLng;
}

export interface Delivery {
  id: string;
  reference: string;
  senderId: string;
  driverId?: string;

  // Package
  packageType: PackageType;
  packageDescription?: string;
  packagePhotoPickupUrl?: string;
  packagePhotoDeliveryUrl?: string;

  // Recipient
  recipientName: string;
  recipientPhone: string;

  // Locations
  pickupAddress: string;
  pickupDetails?: string;
  pickupLocation: LatLng;
  deliveryAddress: string;
  deliveryDetails?: string;
  deliveryLocation: LatLng;

  // Pricing
  estimatedDistanceKm?: number;
  price: number;
  driverCommission?: number;
  platformFee?: number;
  tip: number;

  // Validation
  validationCode: string;

  // Status
  status: DeliveryStatus;

  // Timestamps
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  expiresAt?: string;
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryDraft {
  packageType?: PackageType;
  packageDescription?: string;
  pickupAddress?: string;
  pickupDetails?: string;
  pickupLocation?: LatLng;
  deliveryAddress?: string;
  deliveryDetails?: string;
  deliveryLocation?: LatLng;
  recipientName?: string;
  recipientPhone?: string;
  /** Si defini, la livraison sera programmee pour cette date/heure. */
  scheduledFor?: string; // ISO datetime
}

export interface PriceEstimate {
  price: number;
  distanceKm: number;
  basePrice: number;
  distancePrice: number;
  platformFee: number;
  driverCommission: number;
}

export const PACKAGE_LABELS: Record<PackageType, string> = {
  envelope: 'Enveloppe',
  small: 'Petit colis',
  large: 'Gros colis',
};

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  scheduled: 'Programmee',
  pending: 'En attente',
  accepted: 'Acceptee',
  picking_up: 'En route (recuperation)',
  picked_up: 'Colis recupere',
  delivering: 'En cours de livraison',
  delivered: 'Livree',
  cancelled: 'Annulee',
  expired: 'Expiree',
};
