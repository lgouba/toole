/**
 * Seed un compte admin.
 * Usage: npm run seed:admin -- email@example.com "Nom Prenom" +22670000000 MonMotDePasse123
 * Ou variables env: ADMIN_EMAIL, ADMIN_PHONE, ADMIN_NAME, ADMIN_PASSWORD
 */
import 'dotenv/config';
import { createAdmin } from '../services/admin.service.js';
import { prisma } from '../lib/prisma.js';

async function main() {
  const [, , emailArg, nameArg, phoneArg, passwordArg] = process.argv;
  const email = emailArg ?? process.env.ADMIN_EMAIL;
  const fullName = nameArg ?? process.env.ADMIN_NAME;
  const phone = phoneArg ?? process.env.ADMIN_PHONE;
  const password = passwordArg ?? process.env.ADMIN_PASSWORD;

  if (!email || !fullName || !phone || !password) {
    console.error(
      'Usage: seed-admin <email> <fullName> <phone> <password>\n' +
        '  ou variables env ADMIN_EMAIL / ADMIN_NAME / ADMIN_PHONE / ADMIN_PASSWORD',
    );
    process.exit(1);
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) {
    console.error(`Un utilisateur existe deja avec cet email ou phone (id=${existing.id}).`);
    process.exit(1);
  }

  const user = await createAdmin({ email, fullName, phone, password });
  console.log(`Admin cree: ${user.email} (id=${user.id})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
