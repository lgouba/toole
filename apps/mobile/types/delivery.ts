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
  /** Token court pour partager le suivi public au destinataire. */
  trackingToken?: string | null;
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

  // Expéditeur tiers (optionnel : si le colis est détenu par une autre
  // personne que le client qui a passe la commande)
  senderContactName?: string;
  senderContactPhone?: string;

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
  /** Code que le destinataire donne au livreur pour valider la livraison finale. */
  validationCode: string;
  /**
   * Code que la personne qui detient physiquement le colis au pickup donne au
   * livreur pour valider la récupération. Visible uniquement par le client
   * (l'expéditeur) pour qu'il le transmette a l'expéditeur tiers si besoin.
   */
  pickupValidationCode?: string | null;

  // Status
  status: DeliveryStatus;

  // ETA temps reel (calcule cote serveur via OSRM en fonction du statut)
  // - null si on ne peut pas l'estimer (livreur hors zone, OSRM down, etc.)
  // - durationSeconds : temps trajet voiture pour atteindre la prochaine etape
  //   (pickup si en route pour la recup, delivery si en route pour la livraison)
  eta?: {
    durationSeconds: number;
    distanceMeters: number;
  } | null;

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
  /** Contact de la personne qui detient le colis au pickup (si different du client). */
  senderContactName?: string;
  senderContactPhone?: string;
  /** Si defini, la livraison sera programmée pour cette date/heure. */
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
