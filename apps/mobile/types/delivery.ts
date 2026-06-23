import { LatLng } from './user';

export type PackageType = 'envelope' | 'small' | 'large';

/** Nouvelle categorie de colis (Bundle 2). Info pour le livreur, pas pour le prix. */
export type PackageCategory =
  | 'meal'
  | 'cake'
  | 'fresh'
  | 'grocery'
  | 'pharmacy'
  | 'cosmetics'
  | 'gift'
  | 'other';

/** Nouvelle taille de colis (Bundle 2). Drive le prix de base. */
export type PackageSize = 'small' | 'medium' | 'large';

export const PACKAGE_CATEGORY_META: Record<
  PackageCategory,
  { emoji: string; label: string }
> = {
  meal: { emoji: '🍽️', label: 'Repas & Nourriture' },
  cake: { emoji: '🍰', label: 'Gâteaux & Pâtisseries' },
  fresh: { emoji: '🧊', label: 'Produits frais & Surgelés' },
  grocery: { emoji: '🛒', label: 'Épicerie & Autres courses' },
  pharmacy: { emoji: '💊', label: 'Pharmacie & Produits sensibles' },
  cosmetics: { emoji: '💄', label: 'Cosmétiques & Beauté' },
  gift: { emoji: '🎁', label: 'Cadeaux & Objets fragiles' },
  other: { emoji: '📦', label: 'Colis & Divers' },
};

export const PACKAGE_SIZE_META: Record<
  PackageSize,
  { label: string; weight: string }
> = {
  small: { label: 'Petit', weight: '< 5 kg' },
  medium: { label: 'Moyen', weight: '5-20 kg' },
  large: { label: 'Grand', weight: '+ 20 kg' },
};

/**
 * Mapping legacy PackageType -> nouvelle PackageSize. Permet d'envoyer
 * packageType au serveur (back compat) tout en utilisant la nouvelle taille
 * cote UI.
 */
export const SIZE_TO_LEGACY_TYPE: Record<PackageSize, PackageType> = {
  small: 'small',
  medium: 'small',
  large: 'large',
};

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
  /** Nom du client (expéditeur) — sert d'interlocuteur du chat côté livreur. */
  senderName?: string;
  /** Téléphone du client (expéditeur) — appelé à la récupération si aucun contact tiers. */
  senderPhone?: string;

  // Package
  packageType: PackageType;
  packageCategory?: PackageCategory | null;
  packageSize?: PackageSize | null;
  packageDescription?: string;
  packagePhotoPickupUrl?: string;
  packagePhotoDeliveryUrl?: string;
  /** Valeur déclarée du colis en FCFA (optionnel). */
  declaredValue?: number | null;
  /** Le colis est marqué fragile par le client. */
  isFragile?: boolean;
  /** Code promo applique (snapshot). */
  promoCode?: string | null;
  /** Montant de la remise appliquee (FCFA). */
  promoDiscount?: number | null;
  /** Montant additionnel applique pour le tarif de nuit (snapshot). */
  nightSurchargeApplied?: number | null;

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

  /** Mode de paiement choisi par le client (cash = à encaisser ; OM/Moov = déjà payé). */
  paymentMethod?: 'cash' | 'orange_money' | 'moov_money';

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
  /** Nouvelle catégorie (Bundle 2). */
  packageCategory?: PackageCategory;
  /** Nouvelle taille (Bundle 2). Drive le prix. */
  packageSize?: PackageSize;
  packageDescription?: string;
  /** Valeur déclarée du colis en FCFA (optionnel). */
  declaredValue?: number;
  /** Toggle "colis fragile". */
  isFragile?: boolean;
  /** Code promo saisi par le client (sera applique au submit). */
  promoCode?: string;
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
  /** Mode de paiement choisi par le client. Default = cash a la livraison. */
  paymentMethod?: 'cash' | 'orange_money' | 'moov_money';
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
