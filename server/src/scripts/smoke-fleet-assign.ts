/**
 * Smoke jetable — invariant d'affectation du Parc Auto.
 * Nécessite DATABASE_URL (base de dev). Usage :
 *   npx tsx src/scripts/smoke-fleet-assign.ts
 * Vérifie :
 *  - réaffectation : une seule affectation active par engin, l'ancienne close ;
 *  - un engin `en_panne` n'est pas affectable (VEHICLE_NOT_ASSIGNABLE).
 * Crée des données factices et les nettoie à la fin.
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { assignVehicle } from '../services/fleet.service.js';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

async function main() {
  const tag = `smoke-${Date.now()}`;
  const d1 = await prisma.user.create({
    data: {
      phone: `${tag}-d1`,
      fullName: 'Smoke Driver 1',
      userType: 'driver',
      driverProfile: { create: { vehicleType: 'moto', verificationStatus: 'verified' } },
    },
  });
  const d2 = await prisma.user.create({
    data: {
      phone: `${tag}-d2`,
      fullName: 'Smoke Driver 2',
      userType: 'driver',
      driverProfile: { create: { vehicleType: 'moto', verificationStatus: 'verified' } },
    },
  });
  // Livreur suspendu → non affectable (éligibilité re-vérifiée côté service).
  const dSusp = await prisma.user.create({
    data: {
      phone: `${tag}-ds`,
      fullName: 'Smoke Driver Suspendu',
      userType: 'driver',
      isActive: false,
      suspendedAt: new Date(),
      driverProfile: { create: { vehicleType: 'moto', verificationStatus: 'verified' } },
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: { vehicleType: 'moto', plate: `${tag}-PL`, status: 'en_service', ownerType: 'toole' },
  });
  const broken = await prisma.vehicle.create({
    data: { vehicleType: 'moto', status: 'en_panne', ownerType: 'toole' },
  });

  try {
    await assignVehicle(vehicle.id, d1.id);
    await assignVehicle(vehicle.id, d2.id); // réaffectation

    const active = await prisma.vehicleAssignment.findMany({
      where: { vehicleId: vehicle.id, endedAt: null },
    });
    assert(active.length === 1, `exactement 1 affectation active (eu ${active.length})`);
    assert(active[0].driverId === d2.id, 'affectation active = driver 2');

    const closed = await prisma.vehicleAssignment.findMany({
      where: { vehicleId: vehicle.id, driverId: d1.id, NOT: { endedAt: null } },
    });
    assert(closed.length === 1, 'affectation de driver 1 close');

    let threw = false;
    try {
      await assignVehicle(broken.id, d1.id);
    } catch (e: any) {
      threw = e?.code === 'VEHICLE_NOT_ASSIGNABLE';
    }
    assert(threw, 'engin en panne non affectable (VEHICLE_NOT_ASSIGNABLE)');

    let threwDriver = false;
    try {
      await assignVehicle(vehicle.id, dSusp.id);
    } catch (e: any) {
      threwDriver = e?.code === 'DRIVER_NOT_ASSIGNABLE';
    }
    assert(threwDriver, 'livreur suspendu non affectable (DRIVER_NOT_ASSIGNABLE)');

    console.log('SMOKE_OK');
  } finally {
    await prisma.vehicleAssignment.deleteMany({ where: { vehicleId: { in: [vehicle.id, broken.id] } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: [vehicle.id, broken.id] } } });
    await prisma.driverProfile.deleteMany({ where: { userId: { in: [d1.id, d2.id, dSusp.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [d1.id, d2.id, dSusp.id] } } });
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
