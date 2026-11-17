/**
 * Smoke jetable — agrégation d'activité du Parc Auto.
 * Nécessite DATABASE_URL (base de dev). Usage :
 *   npx tsx src/scripts/smoke-fleet-revenue.ts
 * Vérifie :
 *  - seules les courses `delivered` dans la fenêtre comptent (pas les annulées) ;
 *  - une course après la clôture d'une affectation ne compte pas pour elle,
 *    mais compte pour une nouvelle affectation qui couvre cette période.
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { getAssignmentActivity, getVehicleActivity } from '../services/fleet.service.js';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

let ref = 0;
async function delivery(opts: {
  senderId: string;
  driverId: string;
  status: 'delivered' | 'cancelled';
  deliveredAt: Date | null;
  price: number;
  tag: string;
}) {
  return prisma.delivery.create({
    data: {
      reference: `${opts.tag}-R${ref++}`,
      senderId: opts.senderId,
      driverId: opts.driverId,
      packageType: 'small',
      recipientName: 'Smoke',
      recipientPhone: '22600000000',
      pickupAddress: 'A',
      pickupLat: 12.3,
      pickupLng: -1.5,
      deliveryAddress: 'B',
      deliveryLat: 12.4,
      deliveryLng: -1.6,
      price: opts.price,
      validationCode: '0000',
      status: opts.status,
      deliveredAt: opts.deliveredAt,
    },
  });
}

async function main() {
  const tag = `smokerev-${Date.now()}`;
  const sender = await prisma.user.create({
    data: { phone: `${tag}-s`, fullName: 'Smoke Sender', userType: 'client' },
  });
  const driver = await prisma.user.create({
    data: { phone: `${tag}-d`, fullName: 'Smoke Driver', userType: 'driver' },
  });
  const vehicle = await prisma.vehicle.create({
    data: { vehicleType: 'moto', status: 'en_service', ownerType: 'toole' },
  });

  const start = new Date(Date.now() - 60 * 60 * 1000); // il y a 1h
  const assignment = await prisma.vehicleAssignment.create({
    data: { vehicleId: vehicle.id, driverId: driver.id, startedAt: start },
  });

  const createdDeliveries: string[] = [];
  try {
    // 2 livrées dans la fenêtre + 1 annulée
    const inWindow = new Date(Date.now() - 30 * 60 * 1000);
    const d1 = await delivery({ senderId: sender.id, driverId: driver.id, status: 'delivered', deliveredAt: inWindow, price: 1000, tag });
    const d2 = await delivery({ senderId: sender.id, driverId: driver.id, status: 'delivered', deliveredAt: inWindow, price: 1500, tag });
    const d3 = await delivery({ senderId: sender.id, driverId: driver.id, status: 'cancelled', deliveredAt: null, price: 2000, tag });
    createdDeliveries.push(d1.id, d2.id, d3.id);

    const a1 = await getAssignmentActivity(assignment.id);
    assert(a1.courses === 2, `2 courses livrées (eu ${a1.courses})`);
    assert(a1.totalGenere === 2500, `total généré = 2500 (eu ${a1.totalGenere})`);

    // Clôture de l'affectation MAINTENANT, puis une course après
    const closeAt = new Date();
    await prisma.vehicleAssignment.update({ where: { id: assignment.id }, data: { endedAt: closeAt } });

    const afterClose = new Date(Date.now() + 1000);
    const d4 = await delivery({ senderId: sender.id, driverId: driver.id, status: 'delivered', deliveredAt: afterClose, price: 3000, tag });
    createdDeliveries.push(d4.id);

    const a2 = await getAssignmentActivity(assignment.id);
    assert(a2.courses === 2, `affectation close : toujours 2 courses (eu ${a2.courses})`);

    // Nouvelle affectation couvrant la période post-clôture
    const assignment2 = await prisma.vehicleAssignment.create({
      data: { vehicleId: vehicle.id, driverId: driver.id, startedAt: closeAt },
    });
    const a3 = await getAssignmentActivity(assignment2.id);
    assert(a3.courses === 1 && a3.totalGenere === 3000, `nouvelle affectation : 1 course / 3000 (eu ${a3.courses}/${a3.totalGenere})`);

    // Cumul engin = 3 courses / 6500
    const v = await getVehicleActivity(vehicle.id);
    assert(v.courses === 3 && v.totalGenere === 6500, `cumul engin 3/6500 (eu ${v.courses}/${v.totalGenere})`);

    console.log('SMOKE_OK');
  } finally {
    await prisma.delivery.deleteMany({ where: { id: { in: createdDeliveries } } });
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
