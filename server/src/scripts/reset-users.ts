/**
 * Reset de la base utilisateurs pour repartir sur des inscriptions propres.
 *
 * Supprime :
 *   - Toutes les Deliveries (et leurs Ratings, Transactions liees)
 *   - Tous les DriverLocationLog
 *   - Tous les DriverProfile
 *   - Tous les Transaction
 *   - Tous les RefreshToken
 *   - Tous les PushToken
 *   - Tous les OtpCode
 *   - Tous les PromoCodeUsage
 *   - Tous les User SAUF les admins
 *
 * Garde :
 *   - Comptes admin
 *   - PromoCode (templates)
 *   - AppSettings (singleton)
 *   - PushCampaign (historique des broadcasts)
 *   - ServiceZone (config admin)
 *
 * Usage :
 *   docker compose exec toole-api npm run reset:users
 *   ou en local : npm run reset:users:dev
 */
import 'dotenv/config';
import readline from 'readline';
import { prisma } from '../lib/prisma.js';

async function confirm(question: string): Promise<boolean> {
  // En non-interactif (CI/CD), on accepte via env var RESET_USERS_YES=1
  if (process.env.RESET_USERS_YES === '1') return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question + ' (oui/non) ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase().startsWith('o'));
    });
  });
}

async function main() {
  console.log('[reset-users] Comptage des entites a supprimer…');

  const [
    nonAdminUsers,
    deliveries,
    transactions,
    refreshTokens,
    pushTokens,
    otpCodes,
    driverLocationLogs,
    driverProfiles,
    ratings,
    promoCodeUsages,
  ] = await Promise.all([
    prisma.user.count({ where: { userType: { not: 'admin' } } }),
    prisma.delivery.count(),
    prisma.transaction.count(),
    prisma.refreshToken.count(),
    prisma.pushToken.count(),
    prisma.otpCode.count(),
    prisma.driverLocationLog.count(),
    prisma.driverProfile.count(),
    prisma.rating.count(),
    prisma.promoCodeUsage.count(),
  ]);

  console.log(`  - Users non-admin     : ${nonAdminUsers}`);
  console.log(`  - Deliveries          : ${deliveries}`);
  console.log(`  - Transactions        : ${transactions}`);
  console.log(`  - Ratings             : ${ratings}`);
  console.log(`  - PromoCodeUsages     : ${promoCodeUsages}`);
  console.log(`  - RefreshTokens       : ${refreshTokens}`);
  console.log(`  - PushTokens          : ${pushTokens}`);
  console.log(`  - OtpCodes            : ${otpCodes}`);
  console.log(`  - DriverProfiles      : ${driverProfiles}`);
  console.log(`  - DriverLocationLogs  : ${driverLocationLogs}`);

  const ok = await confirm(
    '\n[reset-users] ATTENTION : confirme la suppression definitive ?',
  );
  if (!ok) {
    console.log('[reset-users] Annule.');
    return;
  }

  // Ordre important pour respecter les contraintes FK.
  console.log('\n[reset-users] Suppression en cours…');
  await prisma.rating.deleteMany();
  console.log('  ✓ Ratings supprimes');
  await prisma.promoCodeUsage.deleteMany();
  console.log('  ✓ PromoCodeUsages supprimes');
  await prisma.transaction.deleteMany();
  console.log('  ✓ Transactions supprimees');
  await prisma.driverLocationLog.deleteMany();
  console.log('  ✓ DriverLocationLogs supprimes');
  await prisma.delivery.deleteMany();
  console.log('  ✓ Deliveries supprimees');
  await prisma.refreshToken.deleteMany();
  console.log('  ✓ RefreshTokens supprimes');
  await prisma.pushToken.deleteMany();
  console.log('  ✓ PushTokens supprimes');
  await prisma.otpCode.deleteMany();
  console.log('  ✓ OtpCodes supprimes');
  await prisma.driverProfile.deleteMany();
  console.log('  ✓ DriverProfiles supprimes');
  const deletedUsers = await prisma.user.deleteMany({
    where: { userType: { not: 'admin' } },
  });
  console.log(`  ✓ Users non-admin supprimes (${deletedUsers.count})`);

  console.log('\n[reset-users] Termine. Les admins sont conserves.');
}

main()
  .catch((err) => {
    console.error('[reset-users] FAILED', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
