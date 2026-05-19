import {
  Delivery,
  DeliveryStatus,
  PackageCategory,
  PackageSize,
  PackageType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  generateReference,
  generateTrackingToken,
  generateValidationCode,
  haversineKm,
} from '../utils/geo.js';
import { calculatePrice } from '../utils/pricing.js';
import { HttpError } from '../utils/response.js';
import { emitToUser, emitToUsers } from './notification.service.js';
import { findNearbyDrivers, notifyPendingDeliveriesToDriver } from './driver.service.js';
import { sendPushToUser } from './push.service.js';
import { logger } from '../lib/logger.js';
import { logDriverLocation } from './location-log.service.js';
import { getAppSettings } from './settings.service.js';
import { sendSms } from '../lib/sms.js';
import { env } from '../config/env.js';
import { computeRouteEta } from '../lib/osrm.js';
import {
  validatePromoCode,
  consumePromoCode,
} from './promo.service.js';

/**
 * Valeur par defaut si AppSettings ne renvoie rien. Lu dynamiquement via
 * `getDeliveryExpiryMs()` qui interroge la DB.
 */
const DEFAULT_DELIVERY_EXPIRY_MS = 5 * 60 * 1000;

async function getDeliveryExpiryMs(): Promise<number> {
  try {
    const s = await getAppSettings();
    return s.deliveryExpiryMinutes * 60 * 1000;
  } catch {
    return DEFAULT_DELIVERY_EXPIRY_MS;
  }
}

async function getDriverCancelCooldownMs(): Promise<number> {
  try {
    const s = await getAppSettings();
    return s.driverCancelCooldownSeconds * 1000;
  } catch {
    return 120 * 1000;
  }
}
async function getNearbyRadiusKm(): Promise<number> {
  try {
    const s = await getAppSettings();
    return s.nearbyRadiusKm;
  } catch {
    return 5;
  }
}

export interface CreateDeliveryInput {
  senderId: string;
  packageType: PackageType;
  /** Nouvelle categorie de colis (info pour le livreur). */
  packageCategory?: PackageCategory;
  /** Nouvelle taille de colis (drive le prix de base). */
  packageSize?: PackageSize;
  packageDescription?: string;
  /** Valeur declaree du colis en FCFA (optionnel). */
  declaredValue?: number;
  /** Indique au livreur que le colis est fragile. */
  isFragile?: boolean;
  /** Code promo a appliquer (insensible a la casse). */
  promoCode?: string;
  recipientName: string;
  recipientPhone: string;
  /** Si le colis est detenu par une autre personne que le client qui commande */
  senderContactName?: string;
  senderContactPhone?: string;
  pickupAddress: string;
  pickupDetails?: string;
  pickupLat: number;
  pickupLng: number;
  deliveryAddress: string;
  deliveryDetails?: string;
  deliveryLat: number;
  deliveryLng: number;
  /** Si fourni (future date), la livraison est programmee et diffusee a cette heure-la. */
  scheduledFor?: Date;
}

export async function createDelivery(input: CreateDeliveryInput): Promise<Delivery> {
  const distanceKm = haversineKm(
    input.pickupLat,
    input.pickupLng,
    input.deliveryLat,
    input.deliveryLng,
  );
  // Pour le pricing, on utilise l'heure de la course (scheduledFor si defini,
  // sinon maintenant). Cela garantit qu'une course programmee a 23h aura
  // bien le tarif de nuit applique au moment de la creation, et que le client
  // voit le bon prix.
  const pricingAt = input.scheduledFor ?? new Date();
  const pricing = await calculatePrice(
    input.packageType,
    distanceKm,
    pricingAt,
    input.packageSize, // Bundle 2 : prix base sur la taille si fournie
  );

  // Bundle 3 : code promo. On valide AVANT de creer la livraison (throw si
  // invalide / expire / quota epuise). consume() est appele apres creation
  // pour avoir l'ID a tracer.
  let promoCodeValue: string | null = null;
  let promoDiscount = 0;
  let priceAfterPromo = pricing.price;
  let driverCommissionAfterPromo = pricing.driverCommission;
  if (input.promoCode?.trim()) {
    const validation = await validatePromoCode(
      input.promoCode,
      input.senderId,
      pricing.price,
    );
    promoCodeValue = validation.code;
    promoDiscount = validation.discountAmount;
    priceAfterPromo = Math.max(0, pricing.price - promoDiscount);
    // La remise est entierement portee par la plateforme : le livreur garde
    // sa commission, on diminue platformFee (qui peut devenir negatif = la
    // plateforme paie pour la course). Si ca devient negatif, on clamp la
    // commission a min(driverCommission, priceAfterPromo) pour eviter de
    // payer le livreur plus que ce que le client paye.
    driverCommissionAfterPromo = Math.min(
      pricing.driverCommission,
      priceAfterPromo,
    );
  }
  const expiryMs = await getDeliveryExpiryMs();

  // Si la date programmee est dans plus de `scheduledMinDelayMinutes` min,
  // on cree en status 'scheduled'. Sinon diffusion immediate.
  // Le seuil est pilote par l'admin (Settings.scheduledMinDelayMinutes).
  const now = Date.now();
  const settingsForSchedule = await getAppSettings();
  const minDelayMs = settingsForSchedule.scheduledMinDelayMinutes * 60 * 1000;
  const isScheduled =
    input.scheduledFor && input.scheduledFor.getTime() - now > minDelayMs;

  const delivery = await prisma.delivery.create({
    data: {
      reference: generateReference(),
      trackingToken: generateTrackingToken(),
      senderId: input.senderId,
      packageType: input.packageType,
      packageCategory: input.packageCategory ?? null,
      packageSize: input.packageSize ?? null,
      packageDescription: input.packageDescription,
      declaredValue: input.declaredValue ?? null,
      isFragile: input.isFragile ?? false,
      nightSurchargeApplied: pricing.nightSurcharge || null,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      senderContactName: input.senderContactName ?? null,
      senderContactPhone: input.senderContactPhone ?? null,
      pickupAddress: input.pickupAddress,
      pickupDetails: input.pickupDetails,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      deliveryAddress: input.deliveryAddress,
      deliveryDetails: input.deliveryDetails,
      deliveryLat: input.deliveryLat,
      deliveryLng: input.deliveryLng,
      estimatedDistanceKm: new Prisma.Decimal(pricing.distanceKm),
      price: priceAfterPromo,
      driverCommission: driverCommissionAfterPromo,
      // Plateforme absorbe la remise : platformFee peut etre 0 ou negatif si
      // la remise est grosse. On stocke tel quel pour l'audit.
      platformFee: priceAfterPromo - driverCommissionAfterPromo,
      promoCode: promoCodeValue,
      promoDiscount: promoDiscount || null,
      validationCode: generateValidationCode(),
      pickupValidationCode: generateValidationCode(),
      status: isScheduled ? 'scheduled' : 'pending',
      scheduledFor: input.scheduledFor ?? null,
      expiresAt: isScheduled
        ? null // l'expiresAt sera pose au moment de la diffusion
        : new Date(now + expiryMs),
    },
  });

  // Bundle 3 : marque le code promo comme consomme (incremente le compteur +
  // cree une entry PromoCodeUsage). Fire-and-forget : si ca echoue, la
  // livraison est tout de meme creee (l'admin peut nettoyer manuellement).
  if (promoCodeValue && promoDiscount > 0) {
    void consumePromoCode({
      code: promoCodeValue,
      userId: input.senderId,
      deliveryId: delivery.id,
      discountAmount: promoDiscount,
    }).catch((err) =>
      logger.warn(
        { err, deliveryId: delivery.id, code: promoCodeValue },
        'consumePromoCode failed (delivery already created)',
      ),
    );
  }

  // Si pas programme, notifier les livreurs immediatement
  if (!isScheduled) {
    void notifyNearbyDrivers(delivery).catch((err) =>
      logger.error({ err, deliveryId: delivery.id }, 'Failed to notify nearby drivers'),
    );
  }

  // Informer le destinataire par SMS (code de livraison + lien suivi).
  // Fire-and-forget : on n'echoue pas la creation si le SMS plante.
  void notifyRecipientNewDelivery(delivery).catch((err) =>
    logger.warn(
      { err, deliveryId: delivery.id },
      'Failed to notify recipient via SMS',
    ),
  );

  return delivery;
}

/**
 * Envoie un SMS au destinataire d'une nouvelle livraison contenant :
 *   - le code de validation a 4 chiffres a donner au livreur a l'arrivee
 *   - un lien de suivi public (si PUBLIC_TRACKING_BASE_URL configure)
 *
 * Sans effet en mode SMS_PROVIDER=dev (le contenu est juste log).
 */
async function notifyRecipientNewDelivery(delivery: Delivery): Promise<void> {
  if (!delivery.recipientPhone) return;

  const code = delivery.validationCode;
  const base = env.PUBLIC_TRACKING_BASE_URL?.replace(/\/+$/, '');
  const trackingUrl = base
    ? `${base}/track/${delivery.trackingToken}`
    : null;

  // SMS court (160 caracteres GSM idealement pour eviter le multi-segment)
  const parts: string[] = [
    `Tolle : un colis vous est envoyé.`,
    `Code à donner au livreur à l'arrivée : ${code}.`,
  ];
  if (trackingUrl) parts.push(`Suivi: ${trackingUrl}`);
  const message = parts.join(' ');

  try {
    await sendSms(delivery.recipientPhone, message);
    logger.info(
      { deliveryId: delivery.id, to: delivery.recipientPhone },
      'Recipient SMS sent for new delivery',
    );
  } catch (err) {
    logger.warn(
      { err, deliveryId: delivery.id },
      'sendSms to recipient failed',
    );
  }
}

/**
 * Scheduler : toutes les 60s, passe les livraisons programmees dont l'heure
 * est arrivee en status 'pending' et les diffuse aux livreurs proches.
 */
export async function processScheduledDeliveries() {
  const now = new Date();
  const due = await prisma.delivery.findMany({
    where: {
      status: 'scheduled',
      scheduledFor: { lte: now },
    },
  });
  if (due.length === 0) return;
  const expiryMs = await getDeliveryExpiryMs();

  for (const d of due) {
    try {
      const updated = await prisma.delivery.update({
        where: { id: d.id },
        data: {
          status: 'pending',
          expiresAt: new Date(Date.now() + expiryMs),
        },
      });
      logger.info({ deliveryId: d.id }, 'Scheduled delivery activated');
      // Notifie le client que sa course programmee est maintenant diffusee
      emitToUser(updated.senderId, 'delivery:status_update', updated);
      void sendPushToUser(
        updated.senderId,
        'Course programmée',
        'Nous recherchons un livreur pour votre course planifiée.',
        { type: 'scheduled_started', deliveryId: updated.id },
      ).catch(() => {});
      void notifyNearbyDrivers(updated).catch(() => {});
    } catch (err) {
      logger.error({ err, deliveryId: d.id }, 'Failed to activate scheduled delivery');
    }
  }
}

async function notifyNearbyDrivers(delivery: Delivery) {
  const radiusKm = await getNearbyRadiusKm();
  const drivers = await findNearbyDrivers(
    delivery.pickupLat,
    delivery.pickupLng,
    radiusKm,
  );
  if (drivers.length === 0) {
    logger.info(
      { deliveryId: delivery.id },
      'Notified nearby drivers (no drivers in zone)',
    );
    return;
  }

  // Pour chaque livreur candidat, on determine s'il est :
  //   - LIBRE (pas de course active)        -> envoi standard
  //   - PRESQUE LIBRE (course active, ETA < seuil) -> envoi avec isChained=true
  //   - OCCUPE                              -> on ne lui envoie rien
  //
  // Cela maximise le taux d'utilisation : un livreur en fin de course reçoit
  // deja la suivante en banniere non-bloquante (style Uber).
  const settings = await getAppSettings();
  const chainingThresholdSec = settings.chainingMaxRemainingMinutes * 60;

  // Recupere les courses actives des candidats
  const driverIds = drivers.map((d) => d.userId);
  const activeDeliveries = await prisma.delivery.findMany({
    where: {
      driverId: { in: driverIds },
      status: { in: ['accepted', 'picking_up', 'picked_up', 'delivering'] },
    },
    include: {
      driver: {
        select: {
          driverProfile: {
            select: { currentLat: true, currentLng: true },
          },
        },
      },
    },
  });
  const activeByDriver = new Map<string, (typeof activeDeliveries)[number]>();
  for (const ad of activeDeliveries) {
    if (ad.driverId) activeByDriver.set(ad.driverId, ad);
  }

  type Eligible = { userId: string; isChained: boolean };
  const eligible: Eligible[] = [];

  for (const driver of drivers) {
    const active = activeByDriver.get(driver.userId);
    if (!active) {
      // Livreur libre → envoi standard
      eligible.push({ userId: driver.userId, isChained: false });
      continue;
    }

    // Livreur avec course active : on chaine UNIQUEMENT si :
    //   - chainage active (chainingMaxRemainingMinutes > 0)
    //   - la course est dans la phase de livraison (colis deja recupere)
    //   - l'ETA jusqu'a la livraison est inferieure au seuil
    if (chainingThresholdSec <= 0) continue;
    if (!['picked_up', 'delivering'].includes(active.status)) continue;

    const profile = active.driver?.driverProfile;
    if (profile?.currentLat == null || profile?.currentLng == null) continue;

    const eta = await computeRouteEta(
      profile.currentLat,
      profile.currentLng,
      active.deliveryLat,
      active.deliveryLng,
    );
    if (!eta) continue; // OSRM indispo → on ne chaine pas par prudence
    if (eta.durationSeconds <= chainingThresholdSec) {
      eligible.push({ userId: driver.userId, isChained: true });
    }
  }

  if (eligible.length === 0) {
    logger.info(
      { deliveryId: delivery.id, nearby: drivers.length },
      'Notified nearby drivers (all currently busy beyond chaining threshold)',
    );
    return;
  }

  // Emission socket avec payload qui INCLUT isChained (le mobile distinguera
  // modal pleine vs banniere non-bloquante).
  const payload = sanitizeForDriver(delivery);
  for (const { userId, isChained } of eligible) {
    emitToUser(userId, 'delivery:new_request', { ...payload, isChained });
  }

  // Push notification UNIQUEMENT aux livreurs libres (les "chaines" auront
  // une banniere in-app, pas besoin de les notifier avec une push push qui
  // peut etre intrusive pendant leur course actuelle).
  const freeIds = eligible.filter((e) => !e.isChained).map((e) => e.userId);
  if (freeIds.length) {
    const title = 'Nouvelle course Tolle';
    const body = `Récupération : ${delivery.pickupAddress}`;
    for (const userId of freeIds) {
      void sendPushToUser(userId, title, body, {
        type: 'new_request',
        deliveryId: delivery.id,
      }).catch(() => {});
    }
  }

  logger.info(
    {
      deliveryId: delivery.id,
      nearby: drivers.length,
      sentFree: freeIds.length,
      sentChained: eligible.length - freeIds.length,
    },
    'Notified nearby drivers',
  );
}

function sanitizeForDriver(delivery: Delivery) {
  // Do not leak validation codes to drivers — they must be given them
  // by the sender / recipient to validate each step.
  const {
    validationCode: _vc,
    pickupValidationCode: _pvc,
    ...rest
  } = delivery;
  return rest;
}

export async function listDeliveries(args: {
  userId: string;
  role: 'sender' | 'driver';
  status?: DeliveryStatus;
}) {
  const where: Prisma.DeliveryWhereInput = {};
  if (args.role === 'sender') where.senderId = args.userId;
  if (args.role === 'driver') where.driverId = args.userId;
  if (args.status) where.status = args.status;

  return prisma.delivery.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
      driver: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
    },
  });
}

/**
 * Vue publique du suivi a partir du token (sans auth).
 * Expose UNIQUEMENT les infos non sensibles : statut, positions, livreur
 * (nom + vehicle + rating), heures, reference. JAMAIS les codes ni les tels.
 *
 * Utilise par la page web /track/<token> que le destinataire ouvre depuis un
 * SMS/WhatsApp partage par le client.
 */
export async function getPublicTrackingByToken(token: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { trackingToken: token },
    include: {
      driver: {
        select: {
          fullName: true,
          avatarUrl: true,
          ratingAvg: true,
          driverProfile: {
            select: {
              vehicleType: true,
              currentLat: true,
              currentLng: true,
              lastLocationUpdate: true,
            },
          },
        },
      },
    },
  });
  if (!delivery) {
    throw new HttpError(404, 'NOT_FOUND', 'Suivi introuvable');
  }

  // ETA via OSRM (driver -> pickup ou delivery selon statut)
  const eta = await computeDeliveryEta(
    delivery.status,
    delivery.driver?.driverProfile?.currentLat ?? null,
    delivery.driver?.driverProfile?.currentLng ?? null,
    delivery.pickupLat,
    delivery.pickupLng,
    delivery.deliveryLat,
    delivery.deliveryLng,
  );

  // Sanitize : on n'expose QUE ce qui est sur la page tracking
  return {
    eta,
    reference: delivery.reference,
    status: delivery.status,
    recipientName: delivery.recipientName,
    packageType: delivery.packageType,
    pickupAddress: delivery.pickupAddress,
    pickupLocation: { latitude: delivery.pickupLat, longitude: delivery.pickupLng },
    deliveryAddress: delivery.deliveryAddress,
    deliveryLocation: {
      latitude: delivery.deliveryLat,
      longitude: delivery.deliveryLng,
    },
    estimatedDistanceKm: delivery.estimatedDistanceKm,
    acceptedAt: delivery.acceptedAt,
    pickedUpAt: delivery.pickedUpAt,
    deliveredAt: delivery.deliveredAt,
    cancelledAt: delivery.cancelledAt,
    expiresAt: delivery.expiresAt,
    driver: delivery.driver
      ? {
          fullName: delivery.driver.fullName,
          avatarUrl: delivery.driver.avatarUrl,
          ratingAvg: delivery.driver.ratingAvg,
          vehicleType: delivery.driver.driverProfile?.vehicleType ?? null,
          currentLocation:
            delivery.driver.driverProfile?.currentLat != null &&
            delivery.driver.driverProfile?.currentLng != null
              ? {
                  latitude: delivery.driver.driverProfile.currentLat,
                  longitude: delivery.driver.driverProfile.currentLng,
                }
              : null,
          lastLocationUpdate: delivery.driver.driverProfile?.lastLocationUpdate ?? null,
        }
      : null,
  };
}

/**
 * Calcule l'ETA pertinent pour la livraison en cours :
 *   - accepted / picking_up : driver -> pickup
 *   - picked_up / delivering : driver -> delivery
 *   - autres statuts : pas d'ETA (null)
 *
 * Retourne null si la position du livreur n'est pas connue ou si l'API OSRM
 * echoue. Le caller doit gracefully cacher l'ETA dans l'UI dans ce cas.
 */
async function computeDeliveryEta(
  status: DeliveryStatus,
  driverLat: number | null | undefined,
  driverLng: number | null | undefined,
  pickupLat: number,
  pickupLng: number,
  deliveryLat: number,
  deliveryLng: number,
): Promise<{ durationSeconds: number; distanceMeters: number } | null> {
  if (driverLat == null || driverLng == null) return null;
  let destLat: number;
  let destLng: number;
  if (status === 'accepted' || status === 'picking_up') {
    destLat = pickupLat;
    destLng = pickupLng;
  } else if (status === 'picked_up' || status === 'delivering') {
    destLat = deliveryLat;
    destLng = deliveryLng;
  } else {
    return null;
  }
  return computeRouteEta(driverLat, driverLng, destLat, destLng);
}

export async function getDeliveryForUser(deliveryId: string, userId: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      sender: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
      driver: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          avatarUrl: true,
          ratingAvg: true,
          driverProfile: {
            select: {
              vehicleType: true,
              currentLat: true,
              currentLng: true,
            },
          },
        },
      },
    },
  });
  if (!delivery) {
    throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  }
  if (delivery.senderId !== userId && delivery.driverId !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'Access denied');
  }

  // ETA calcule via OSRM (cache 15s) pour les statuts "en route"
  const eta = await computeDeliveryEta(
    delivery.status,
    delivery.driver?.driverProfile?.currentLat ?? null,
    delivery.driver?.driverProfile?.currentLng ?? null,
    delivery.pickupLat,
    delivery.pickupLng,
    delivery.deliveryLat,
    delivery.deliveryLng,
  );

  // Only sender should see validation codes (delivery + pickup)
  if (delivery.senderId !== userId) {
    return { ...delivery, validationCode: null, pickupValidationCode: null, eta };
  }
  return { ...delivery, eta };
}

export async function acceptDelivery(deliveryId: string, driverId: string) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) {
    throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  }
  if (delivery.status !== 'pending') {
    throw new HttpError(400, 'INVALID_STATE', 'Delivery is not pending');
  }
  if (delivery.expiresAt && delivery.expiresAt < new Date()) {
    throw new HttpError(400, 'EXPIRED', 'Delivery request has expired');
  }

  // Verifie la dette commission du livreur : bloque si au-dela du plafond admin.
  const settings = await getAppSettings();
  const balanceCheck = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { walletBalance: true },
  });
  // walletBalance negatif = dette. On compare sa valeur absolue au plafond.
  const currentDebt = Math.max(0, -(balanceCheck?.walletBalance ?? 0));
  if (currentDebt >= settings.commissionDebtLimit) {
    throw new HttpError(
      403,
      'DEBT_LIMIT_EXCEEDED',
      `Votre dette plateforme (${currentDebt} ${settings.currency}) a atteint le plafond. Reglez via l'onglet Portefeuille pour accepter de nouvelles courses.`,
    );
  }

  // ⚠️ ATOMIC UPDATE : updateMany avec WHERE status='pending' garantit
  // qu'UN SEUL livreur peut accepter (le SQL UPDATE est atomique).
  // Si 2 drivers cliquent en meme temps, le 2eme aura count=0.
  const updateResult = await prisma.delivery.updateMany({
    where: { id: deliveryId, status: 'pending' },
    data: {
      driverId,
      status: 'accepted',
      acceptedAt: new Date(),
    },
  });
  if (updateResult.count === 0) {
    throw new HttpError(
      409,
      'ALREADY_TAKEN',
      'Cette course vient d\'etre acceptee par un autre livreur.',
    );
  }
  // Recharge la livraison apres update (updateMany ne retourne pas la row)
  const updated = (await prisma.delivery.findUnique({
    where: { id: deliveryId },
  }))!;

  emitToUser(updated.senderId, 'delivery:accepted', updated);
  emitToUser(driverId, 'delivery:status_update', updated);

  // Push au client : livreur en route (app client en background / ecran eteint)
  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: { fullName: true },
  });
  void sendPushToUser(
    updated.senderId,
    'Livreur en route',
    `${driver?.fullName ?? 'Un livreur'} a accepté votre course`,
    { type: 'delivery_accepted', deliveryId: updated.id },
  ).catch(() => {});

  // Pousse tout de suite la position connue du livreur pour que le client voie
  // son marqueur apparaitre immediatement (sans attendre le prochain heartbeat).
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { currentLat: true, currentLng: true, lastLocationUpdate: true },
  });
  if (
    driverProfile?.currentLat != null &&
    driverProfile.currentLng != null
  ) {
    emitToUser(updated.senderId, 'delivery:driver_location', {
      driverId,
      deliveryId: updated.id,
      latitude: driverProfile.currentLat,
      longitude: driverProfile.currentLng,
      updatedAt: driverProfile.lastLocationUpdate,
    });
    // Tracabilite : log l'acceptation avec position + reference de livraison
    void logDriverLocation({
      driverId,
      latitude: driverProfile.currentLat,
      longitude: driverProfile.currentLng,
      event: 'accept',
      deliveryId: updated.id,
    });
  }

  // Avertir les autres livreurs proches que la course n'est plus disponible
  void (async () => {
    const radiusKm = await getNearbyRadiusKm();
    const drivers = await findNearbyDrivers(
      updated.pickupLat,
      updated.pickupLng,
      radiusKm,
    );
    const otherIds = drivers.map((d) => d.userId).filter((id) => id !== driverId);
    if (otherIds.length) {
      emitToUsers(otherIds, 'delivery:invalidated', {
        deliveryId: updated.id,
        reason: 'taken',
      });
    }
  })().catch(() => {});

  return updated;
}

export async function rejectDelivery(deliveryId: string, driverId: string) {
  logger.info({ deliveryId, driverId }, 'Driver rejected delivery');

  // Apres un refus, on verifie si d'autres demandes pending existent dans sa
  // zone (ex: une course de client B qu'il avait ignoree quand il regardait
  // celle de client A). On les lui repousse pour qu'il ne rate pas
  // l'opportunite.
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { currentLat: true, currentLng: true, isOnline: true },
  });
  if (
    profile?.isOnline &&
    profile.currentLat != null &&
    profile.currentLng != null
  ) {
    void notifyPendingDeliveriesToDriver(
      driverId,
      profile.currentLat,
      profile.currentLng,
    ).catch(() => {});
  }

  return { ok: true };
}

/**
 * Relance une demande expiree ou pending: remet le statut a pending, reinitialise expiresAt
 * et rebroadcast aux livreurs proches.
 */
export async function relaunchDelivery(deliveryId: string, userId: string) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  if (delivery.senderId !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'Access denied');
  }
  if (!['pending', 'expired'].includes(delivery.status)) {
    throw new HttpError(
      400,
      'INVALID_STATE',
      'Seules les demandes en attente ou expirees peuvent etre relancees',
    );
  }

  const expiryMs = await getDeliveryExpiryMs();
  const updated = await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'pending',
      expiresAt: new Date(Date.now() + expiryMs),
    },
  });

  // Re-notify nearby drivers
  void notifyNearbyDrivers(updated).catch((err) =>
    logger.error({ err, deliveryId }, 'Failed to re-notify on relaunch'),
  );

  return updated;
}

export async function confirmPickup(
  deliveryId: string,
  driverId: string,
  photoUrl: string,
  pickupCode: string,
) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  if (delivery.driverId !== driverId) {
    throw new HttpError(403, 'FORBIDDEN', 'Not your delivery');
  }
  if (!['accepted', 'picking_up'].includes(delivery.status)) {
    throw new HttpError(400, 'INVALID_STATE', 'Delivery cannot be picked up');
  }
  if (delivery.pickupValidationCode !== pickupCode) {
    throw new HttpError(
      400,
      'INVALID_PICKUP_CODE',
      'Code de recuperation incorrect',
    );
  }
  // Atomic : WHERE conditionne sur driverId + status pour eviter qu'un
  // double submit ne reapplique la confirmation (et reecrive la photo).
  const result = await prisma.delivery.updateMany({
    where: {
      id: deliveryId,
      driverId,
      status: { in: ['accepted', 'picking_up'] },
    },
    data: {
      status: 'picked_up',
      pickedUpAt: new Date(),
      packagePhotoPickupUrl: photoUrl,
    },
  });
  if (result.count === 0) {
    throw new HttpError(
      409,
      'ALREADY_PICKED_UP',
      'Cette course a deja ete confirmee.',
    );
  }
  const updated = (await prisma.delivery.findUnique({
    where: { id: deliveryId },
  }))!;
  emitToUser(updated.senderId, 'delivery:status_update', updated);
  emitToUser(driverId, 'delivery:status_update', updated);

  // Push au client: colis recupere
  void sendPushToUser(
    updated.senderId,
    'Colis récupéré',
    'Votre colis est en route vers le destinataire',
    { type: 'delivery_picked_up', deliveryId: updated.id },
  ).catch(() => {});

  // Tracabilite : log position + event pickup
  const dp = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { currentLat: true, currentLng: true },
  });
  if (dp?.currentLat != null && dp.currentLng != null) {
    void logDriverLocation({
      driverId,
      latitude: dp.currentLat,
      longitude: dp.currentLng,
      event: 'pickup',
      deliveryId: updated.id,
    });
  }

  return updated;
}

export async function validateCode(
  deliveryId: string,
  driverId: string,
  code: string,
) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  if (delivery.driverId !== driverId) {
    throw new HttpError(403, 'FORBIDDEN', 'Not your delivery');
  }
  if (!['picked_up', 'delivering'].includes(delivery.status)) {
    throw new HttpError(400, 'INVALID_STATE', 'Delivery cannot be completed');
  }
  if (delivery.validationCode !== code) {
    throw new HttpError(400, 'INVALID_CODE', 'Validation code is incorrect');
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Atomic : WHERE conditionne sur le status pour eviter une double-validation
    // qui creerait 2 transactions de commission.
    const result = await tx.delivery.updateMany({
      where: {
        id: deliveryId,
        driverId,
        status: { in: ['picked_up', 'delivering'] },
      },
      data: { status: 'delivered', deliveredAt: new Date() },
    });
    if (result.count === 0) {
      throw new HttpError(
        409,
        'ALREADY_DELIVERED',
        'Cette livraison a deja ete validee.',
      );
    }
    const d = (await tx.delivery.findUnique({ where: { id: deliveryId } }))!;

    if (d.driverCommission && d.platformFee && d.driverId) {
      // Modele cash : le client paie tout le prix cash au livreur.
      // - Le livreur encaisse driverCommission (gain net) physiquement.
      // - Il doit platformFee a la plateforme (dette cumulee).
      //
      // On enregistre 2 transactions pour la tracabilite :
      //   1. commission      : + driverCommission (gain historique, paymentMethod=cash)
      //   2. commission_debt : - platformFee (dette cumulee envers la plateforme)
      //
      // Le walletBalance du livreur est decremente de platformFee : il represente
      // la "balance nette" de ses obligations envers la plateforme. S'il devient
      // tres negatif, le livreur est bloque jusqu'a ce qu'il regle sa dette.
      await tx.transaction.create({
        data: {
          userId: d.driverId,
          deliveryId: d.id,
          type: 'commission',
          amount: d.driverCommission,
          paymentMethod: 'cash',
          status: 'completed',
          note: 'Gain livreur (paiement cash du client)',
        },
      });
      await tx.transaction.create({
        data: {
          userId: d.driverId,
          deliveryId: d.id,
          type: 'commission_debt',
          amount: -d.platformFee,
          paymentMethod: 'cash',
          status: 'completed',
          note: 'Commission plateforme due (paiement cash)',
        },
      });
      await tx.driverProfile.update({
        where: { userId: d.driverId },
        data: {
          walletBalance: { decrement: d.platformFee },
          totalDeliveries: { increment: 1 },
        },
      });
    }
    return d;
  });

  emitToUser(updated.senderId, 'delivery:status_update', updated);
  emitToUser(driverId, 'delivery:status_update', updated);

  // Push au client: livraison terminee (incite a noter)
  void sendPushToUser(
    updated.senderId,
    'Livraison terminée',
    'Votre colis a été livré. Notez votre livreur !',
    { type: 'delivery_delivered', deliveryId: updated.id },
  ).catch(() => {});

  // Tracabilite : log position + event delivered
  const dp = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { currentLat: true, currentLng: true },
  });
  if (dp?.currentLat != null && dp.currentLng != null) {
    void logDriverLocation({
      driverId,
      latitude: dp.currentLat,
      longitude: dp.currentLng,
      event: 'delivered',
      deliveryId: updated.id,
    });
  }

  return updated;
}

export type CancelReason =
  | 'client_cancelled'
  | 'driver_unavailable'
  | 'driver_too_far'
  | 'package_issue'
  | 'recipient_unreachable'
  | 'no_driver_found'
  | 'other';

export async function cancelDelivery(
  deliveryId: string,
  userId: string,
  reason?: CancelReason,
  comment?: string,
) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  if (delivery.senderId !== userId && delivery.driverId !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'Access denied');
  }
  if (['delivered', 'cancelled', 'expired'].includes(delivery.status)) {
    throw new HttpError(400, 'INVALID_STATE', 'Delivery cannot be cancelled');
  }

  const isDriverCancel = userId === delivery.driverId;

  // Fenetre de grace : un livreur a `driverCancelCooldownSeconds` pour annuler
  // apres avoir accepte. Passee cette fenetre, il est engage et ne peut plus
  // annuler librement (il doit contacter le support ou finir la course).
  if (
    isDriverCancel &&
    delivery.acceptedAt &&
    delivery.status !== 'picked_up' &&
    delivery.status !== 'delivering'
  ) {
    const cooldownMs = await getDriverCancelCooldownMs();
    const elapsedMs = Date.now() - delivery.acceptedAt.getTime();
    if (elapsedMs >= cooldownMs) {
      throw new HttpError(
        403,
        'CANCEL_WINDOW_EXPIRED',
        "Le delai pour annuler cette course est ecoule.",
      );
    }
  }

  const canReassignToOthers =
    isDriverCancel &&
    delivery.status !== 'picked_up' &&
    delivery.status !== 'delivering';

  // Cas special : le livreur annule une course deja acceptee (mais pas encore recuperee)
  // → on remet en pending pour que d'autres livreurs puissent la prendre.
  if (canReassignToOthers) {
    const expiryMs = await getDeliveryExpiryMs();
    const updated = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: 'pending',
        driverId: null,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + expiryMs),
      },
    });

    // Avertir le client que le livreur a abandonne et qu'on cherche un autre
    emitToUser(updated.senderId, 'delivery:driver_cancelled', {
      delivery: updated,
      reason: reason ?? 'driver_unavailable',
      comment,
    });

    // Re-notifier les autres livreurs proches
    void notifyNearbyDrivers(updated).catch((err) =>
      logger.error({ err, deliveryId }, 'Failed to re-notify after driver cancel'),
    );

    logger.info({ deliveryId, driverId: userId, reason }, 'Driver cancelled, re-posted');
    return updated;
  }

  // Sinon: annulation definitive
  const updated = await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: reason,
      cancelComment: comment,
      cancelledBy: userId,
    },
  });

  // Si la livraison etait encore pending, elle a ete broadcastee aux livreurs proches:
  // il faut les avertir qu'elle n'est plus disponible.
  if (delivery.status === 'pending') {
    void broadcastDeliveryInvalidation(delivery, 'cancelled').catch((err) =>
      logger.error({ err, deliveryId }, 'Failed to broadcast cancellation'),
    );
  }

  const otherParty =
    userId === updated.senderId ? updated.driverId : updated.senderId;
  if (otherParty) emitToUser(otherParty, 'delivery:cancelled', updated);

  // Tracabilite : si un livreur annule, on log sa position
  if (isDriverCancel && updated.driverId) {
    const dp = await prisma.driverProfile.findUnique({
      where: { userId: updated.driverId },
      select: { currentLat: true, currentLng: true },
    });
    if (dp?.currentLat != null && dp.currentLng != null) {
      void logDriverLocation({
        driverId: updated.driverId,
        latitude: dp.currentLat,
        longitude: dp.currentLng,
        event: 'cancel',
        deliveryId: updated.id,
      });
    }
  }

  return updated;
}

/**
 * Avertit tous les livreurs proches du pickup qu'une demande en attente n'est plus disponible
 * (annulee ou expiree). Ils doivent fermer l'ecran "Nouvelle demande" si affiche.
 */
async function broadcastDeliveryInvalidation(
  delivery: Delivery,
  reason: 'cancelled' | 'expired',
) {
  const radiusKm = await getNearbyRadiusKm();
  const drivers = await findNearbyDrivers(
    delivery.pickupLat,
    delivery.pickupLng,
    radiusKm,
  );
  const ids = drivers.map((d) => d.userId);
  if (ids.length) {
    emitToUsers(ids, 'delivery:invalidated', {
      deliveryId: delivery.id,
      reason,
    });
  }
}

/**
 * Scan periodique des livraisons pending expirees et diffusion aux livreurs.
 */
export async function expirePendingDeliveries() {
  const now = new Date();
  const toExpire = await prisma.delivery.findMany({
    where: {
      status: 'pending',
      expiresAt: { lt: now },
    },
  });

  for (const d of toExpire) {
    const updated = await prisma.delivery.update({
      where: { id: d.id },
      data: { status: 'expired' },
    });
    emitToUser(updated.senderId, 'delivery:expired', updated);
    void broadcastDeliveryInvalidation(d, 'expired').catch(() => {});
  }

  if (toExpire.length) {
    logger.info({ count: toExpire.length }, 'Expired pending deliveries');
  }
}

export async function rateDelivery(args: {
  deliveryId: string;
  raterId: string;
  score: number;
  comment?: string;
}) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: args.deliveryId },
  });
  if (!delivery) throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  if (delivery.status !== 'delivered') {
    throw new HttpError(400, 'INVALID_STATE', 'Can only rate delivered orders');
  }
  if (
    args.raterId !== delivery.senderId &&
    args.raterId !== delivery.driverId
  ) {
    throw new HttpError(403, 'FORBIDDEN', 'Access denied');
  }
  const ratedId =
    args.raterId === delivery.senderId ? delivery.driverId : delivery.senderId;
  if (!ratedId) {
    throw new HttpError(400, 'INVALID_STATE', 'No counterpart to rate');
  }

  const rating = await prisma.$transaction(async (tx) => {
    const r = await tx.rating.create({
      data: {
        deliveryId: args.deliveryId,
        raterId: args.raterId,
        ratedId,
        score: args.score,
        comment: args.comment,
      },
    });
    // Recompute average
    const agg = await tx.rating.aggregate({
      where: { ratedId },
      _avg: { score: true },
      _count: { _all: true },
    });
    await tx.user.update({
      where: { id: ratedId },
      data: {
        ratingAvg: new Prisma.Decimal(
          Math.round((agg._avg.score ?? 5) * 10) / 10,
        ),
        ratingCount: agg._count._all,
      },
    });
    return r;
  });

  return rating;
}

export async function estimatePrice(
  packageType: PackageType,
  pickupLat: number,
  pickupLng: number,
  deliveryLat: number,
  deliveryLng: number,
  packageSize?: PackageSize,
) {
  const distanceKm = haversineKm(pickupLat, pickupLng, deliveryLat, deliveryLng);
  return calculatePrice(packageType, distanceKm, new Date(), packageSize);
}
