import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const SINGLETON_ID = 'default';

/**
 * Cache en memoire des settings pour eviter un hit DB a chaque calcul de prix.
 * Invalide apres N secondes. Permet d'avoir un pricing reactif sans etre lent.
 */
let cache: { data: any; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30s

export async function getAppSettings() {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  let settings = await prisma.appSettings.findUnique({
    where: { id: SINGLETON_ID },
  });

  if (!settings) {
    // Premiere fois : on cree la ligne avec les defaults du schema.
    settings = await prisma.appSettings.create({
      data: { id: SINGLETON_ID },
    });
    logger.info({ id: SINGLETON_ID }, 'AppSettings initialized with defaults');
  }

  cache = { data: settings, expiresAt: Date.now() + CACHE_TTL_MS };
  return settings;
}

export async function updateAppSettings(
  updates: Partial<{
    appName: string;
    primaryColor: string;
    secondaryColor: string;
    currency: string;
    currencyLocale: string;
    basePriceEnvelope: number;
    basePriceSmall: number;
    basePriceMedium: number;
    basePriceLarge: number;
    pricePerKm: number;
    platformCommissionPct: number;
    confettiEnabled: boolean;
    driverSoundEnabled: boolean;
    driverVibrationEnabled: boolean;
    nightSurchargeEnabled: boolean;
    nightSurchargeStartHour: number;
    nightSurchargeEndHour: number;
    nightSurchargeAmount: number;
    rainSurchargePct: number;
    deliveryExpiryMinutes: number;
    driverCancelCooldownSeconds: number;
    nearbyRadiusKm: number;
    chainingMaxRemainingMinutes: number;
    driverHeartbeatMaxAgeSeconds: number;
    minWithdrawAmount: number;
    commissionDebtLimit: number;
    scheduledMinDelayMinutes: number;
    minSupportedAppVersion: string;
    forceUpdateMessage: string | null;
  }>,
  updatedBy?: string,
) {
  await getAppSettings(); // garantit que la ligne existe

  const settings = await prisma.appSettings.update({
    where: { id: SINGLETON_ID },
    data: {
      ...updates,
      updatedBy: updatedBy ?? null,
    },
  });

  // Invalider le cache
  cache = { data: settings, expiresAt: Date.now() + CACHE_TTL_MS };
  return settings;
}

/** Renvoie uniquement les settings "publics" (non sensibles) pour le mobile. */
export function publicSettings(s: Awaited<ReturnType<typeof getAppSettings>>) {
  return {
    appName: s.appName,
    primaryColor: s.primaryColor,
    secondaryColor: s.secondaryColor,
    currency: s.currency,
    currencyLocale: s.currencyLocale,
    confettiEnabled: s.confettiEnabled,
    driverSoundEnabled: s.driverSoundEnabled,
    driverVibrationEnabled: s.driverVibrationEnabled,
    // Prix expose pour que le mobile puisse afficher une estimation
    // immediate sans round-trip. Le backend reste source de verite au
    // moment de la creation reelle de la livraison.
    pricing: {
      basePriceEnvelope: s.basePriceEnvelope,
      basePriceSmall: s.basePriceSmall,
      basePriceMedium: s.basePriceMedium,
      basePriceLarge: s.basePriceLarge,
      pricePerKm: s.pricePerKm,
      platformCommissionPct: s.platformCommissionPct,
    },
    operations: {
      deliveryExpiryMinutes: s.deliveryExpiryMinutes,
      driverCancelCooldownSeconds: s.driverCancelCooldownSeconds,
      nearbyRadiusKm: s.nearbyRadiusKm,
      scheduledMinDelayMinutes: s.scheduledMinDelayMinutes,
    },
    // Version mobile min supportee (force update kill switch)
    minSupportedAppVersion: s.minSupportedAppVersion,
    forceUpdateMessage: s.forceUpdateMessage,
    // Tarif de nuit : expose au mobile pour qu'il puisse afficher le badge
    // "Tarif de nuit" et l'estimation correcte avant submit.
    nightSurcharge: {
      enabled: s.nightSurchargeEnabled,
      startHour: s.nightSurchargeStartHour,
      endHour: s.nightSurchargeEndHour,
      amount: s.nightSurchargeAmount,
    },
  };
}

/**
 * Determine si une date donnee tombe dans la plage horaire de nuit configuree.
 * Gere le cas ou la plage traverse minuit (ex: 22h -> 6h).
 */
export function isNightTime(date: Date, startHour: number, endHour: number): boolean {
  const h = date.getHours();
  if (startHour === endHour) return false;
  if (startHour < endHour) {
    // plage classique (ex: 13h -> 18h)
    return h >= startHour && h < endHour;
  }
  // plage qui traverse minuit (ex: 22h -> 6h)
  return h >= startHour || h < endHour;
}
