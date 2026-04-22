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
    basePriceLarge: number;
    pricePerKm: number;
    platformCommissionPct: number;
    confettiEnabled: boolean;
    driverSoundEnabled: boolean;
    driverVibrationEnabled: boolean;
    nightSurchargePct: number;
    rainSurchargePct: number;
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
  };
}
