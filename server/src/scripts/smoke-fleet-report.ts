/**
 * Smoke jetable — séries temporelles du Parc Auto (Lot 2).
 * Nécessite DATABASE_URL (base de dev). Usage :
 *   npx tsx src/scripts/smoke-fleet-report.ts
 * Vérifie, en granularité 'month' :
 *  - une course par mois tombe dans le bon bucket ;
 *  - un mois sans course est présent à 0 (buckets comblés) ;
 *  - une course AVANT le début de l'affectation (hors fenêtre) est exclue.
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { getVehicleReport } from '../services/fleet.service.js';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

function monthsAgoUTC(n: number): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  d.setUTCDate(15);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}
function monthKey(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

let ref = 0;
async function delivery(senderId: string, driverId: string, deliveredAt: Date, price: number, tag: string) {
  return prisma.delivery.create({
    data: {
      reference: `${tag}-R${ref++}`,
      senderId,
      driverId,
      packageType: 'small',
      recipientName: 'Smoke',
      recipientPhone: '22600000000',
      pickupAddress: 'A',
      pickupLat: 12.3,
      pickupLng: -1.5,
      deliveryAddress: 'B',
      deliveryLat: 12.4,
      deliveryLng: -1.6,
      price,
      validationCode: '0000',
      status: 'delivered',
      deliveredAt,
    },
  });
}

async function main() {
  const tag = `smokerep-${Date.now()}`;
  const sender = await prisma.user.create({ data: { phone: `${tag}-s`, fullName: 'S', userType: 'client' } });
  const driver = await prisma.user.create({ data: { phone: `${tag}-d`, fullName: 'D', userType: 'driver' } });
  const vehicle = await prisma.vehicle.create({ data: { vehicleType: 'moto', status: 'en_service', ownerType: 'toole' } });

  const startedAt = monthsAgoUTC(3); // affectation ouverte depuis 3 mois
  await prisma.vehicleAssignment.create({ data: { vehicleId: vehicle.id, driverId: driver.id, startedAt } });

  const created: string[] = [];
  try {
    const m2 = monthsAgoUTC(2);
    const m1 = monthsAgoUTC(1);
    const outside = monthsAgoUTC(4); // avant startedAt → hors fenêtre
    const d2 = await delivery(sender.id, driver.id, m2, 1000, tag);
    const d1 = await delivery(sender.id, driver.id, m1, 1500, tag);
    const dOut = await delivery(sender.id, driver.id, outside, 9999, tag);
    created.push(d2.id, d1.id, dOut.id);

    const from = monthsAgoUTC(5); // couvre outside ET la fenêtre
    const to = new Date();
    const { series, totals } = await getVehicleReport(vehicle.id, 'month', from, to);

    const byKey = new Map(series.map((b) => [b.period, b]));
    assert(byKey.get(monthKey(m2))?.courses === 1, 'bucket M-2 = 1 course');
    assert(byKey.get(monthKey(m1))?.courses === 1, 'bucket M-1 = 1 course');
    assert(byKey.get(monthKey(m1))?.totalGenere === 1500, 'bucket M-1 total = 1500');
    // mois d'il y a 4 mois : la course "outside" est avant startedAt → exclue → 0
    assert(byKey.get(monthKey(outside))?.courses === 0, 'course hors fenêtre exclue (bucket M-4 = 0)');
    // un bucket sans course existe bien (comblé à 0)
    assert(series.every((b) => typeof b.courses === 'number'), 'tous les buckets présents');
    assert(totals.courses === 2 && totals.totalGenere === 2500, `totals 2/2500 (eu ${totals.courses}/${totals.totalGenere})`);

    console.log('SMOKE_OK');
  } finally {
    await prisma.delivery.deleteMany({ where: { id: { in: created } } });
    await prisma.vehicleAssignment.deleteMany({ where: { vehicleId: vehicle.id } });
    await prisma.vehicle.deleteMany({ where: { id: vehicle.id } });
    await prisma.user.deleteMany({ where: { id: { in: [sender.id, driver.id] } } });
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
