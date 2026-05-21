/**
 * Migration : pour les anciens utilisateurs qui n'ont que `fullName` rempli
 * (firstName et lastName null), on split intelligemment fullName en
 * firstName + lastName.
 *
 * Strategie :
 *   - Si `fullName` ne contient qu'un mot   -> firstName = mot,    lastName = ''
 *   - Si `fullName` contient 2 mots         -> firstName = 1er,    lastName = 2e
 *   - Si `fullName` contient 3+ mots        -> firstName = 1er,    lastName = reste
 *
 * Idempotent : skip les users qui ont deja firstName ET lastName remplis.
 *
 * Usage :
 *   docker compose exec tolle-api node dist/scripts/migrate-fullname-to-first-last.js
 *   (apres rebuild de l'image)
 *
 * Ou en local :
 *   tsx server/src/scripts/migrate-fullname-to-first-last.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

function splitFullName(full: string): { firstName: string; lastName: string } {
  const cleaned = full.trim().replace(/\s+/g, ' ');
  if (!cleaned) return { firstName: '', lastName: '' };
  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

async function main() {
  console.log('[migration] Starting fullName -> firstName/lastName split…');

  // Cherche les users avec fullName non vide mais firstName ou lastName vide.
  const candidates = await prisma.user.findMany({
    where: {
      OR: [{ firstName: null }, { lastName: null }],
    },
    select: { id: true, fullName: true, firstName: true, lastName: true, phone: true },
  });

  console.log(`[migration] Found ${candidates.length} users to migrate.`);

  let updated = 0;
  let skipped = 0;

  for (const u of candidates) {
    // Skip si firstName et lastName sont deja remplis (double-check)
    if (u.firstName && u.lastName) {
      skipped++;
      continue;
    }
    const { firstName, lastName } = splitFullName(u.fullName);
    if (!firstName) {
      console.warn(`[migration] User ${u.id} (${u.phone}) has empty fullName, skipping`);
      skipped++;
      continue;
    }

    await prisma.user.update({
      where: { id: u.id },
      data: {
        firstName: u.firstName ?? firstName,
        lastName: u.lastName ?? lastName,
      },
    });
    console.log(
      `[migration] ${u.phone} : "${u.fullName}" -> firstName="${firstName}" lastName="${lastName}"`,
    );
    updated++;
  }

  console.log(`[migration] Done. Updated: ${updated}, skipped: ${skipped}.`);
}

main()
  .catch((err) => {
    console.error('[migration] FAILED', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
