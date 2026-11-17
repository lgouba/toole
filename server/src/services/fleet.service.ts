import { Prisma } from '@prisma/client';
import type {
  Shareholder,
  Vehicle,
  VehicleStatus,
  VehicleOwnerType,
  VehicleType,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/response.js';

// ---------------------------------------------------------------------------
// Includes partagés
// ---------------------------------------------------------------------------

/** Affectation active (endedAt null) + livreur minimal, pour lister/afficher. */
const activeAssignmentInclude = {
  assignments: {
    where: { endedAt: null },
    take: 1,
    include: { driver: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.VehicleInclude;

type VehicleWithActive = Prisma.VehicleGetPayload<{
  include: {
    shareholder: true;
    assignments: {
      where: { endedAt: null };
      include: { driver: { select: { id: true; fullName: true } } };
    };
  };
}>;

export type VehicleListRow = Omit<VehicleWithActive, 'assignments'> & {
  activeAssignment: VehicleWithActive['assignments'][number] | null;
};

function toListRow(v: VehicleWithActive): VehicleListRow {
  const { assignments, ...rest } = v;
  return { ...rest, activeAssignment: assignments[0] ?? null };
}

// ---------------------------------------------------------------------------
// Actionnaires
// ---------------------------------------------------------------------------

export async function listShareholders(): Promise<Shareholder[]> {
  return prisma.shareholder.findMany({
    orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
  });
}

export interface ShareholderInput {
  fullName: string;
  phone?: string;
  email?: string;
  note?: string;
}

export async function createShareholder(input: ShareholderInput): Promise<Shareholder> {
  return prisma.shareholder.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      note: input.note,
    },
  });
}

export async function getShareholder(
  id: string,
): Promise<Shareholder & { vehicles: Vehicle[] }> {
  const sh = await prisma.shareholder.findUnique({
    where: { id },
    include: { vehicles: { orderBy: { createdAt: 'desc' } } },
  });
  if (!sh) throw new HttpError(404, 'NOT_FOUND', 'Actionnaire introuvable');
  return sh;
}

export async function updateShareholder(
  id: string,
  patch: Partial<ShareholderInput>,
): Promise<Shareholder> {
  await ensureShareholder(id);
  return prisma.shareholder.update({ where: { id }, data: patch });
}

export async function archiveShareholder(id: string): Promise<Shareholder> {
  await ensureShareholder(id);
  return prisma.shareholder.update({ where: { id }, data: { isActive: false } });
}

async function ensureShareholder(id: string): Promise<void> {
  const exists = await prisma.shareholder.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new HttpError(404, 'NOT_FOUND', 'Actionnaire introuvable');
}

// ---------------------------------------------------------------------------
// Engins
// ---------------------------------------------------------------------------

export interface VehicleFilter {
  status?: VehicleStatus;
  ownerType?: VehicleOwnerType;
  /** true = seulement les engins affectés ; false = seulement les libres. */
  assigned?: boolean;
}

export async function listVehicles(filter: VehicleFilter = {}): Promise<VehicleListRow[]> {
  const where: Prisma.VehicleWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.ownerType) where.ownerType = filter.ownerType;
  if (filter.assigned === true) where.assignments = { some: { endedAt: null } };
  if (filter.assigned === false) where.assignments = { none: { endedAt: null } };

  const rows = await prisma.vehicle.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { shareholder: true, ...activeAssignmentInclude },
  });
  return rows.map((r) => toListRow(r as VehicleWithActive));
}

export interface VehicleInput {
  vehicleType: VehicleType;
  brand?: string;
  model?: string;
  plate?: string;
  status?: VehicleStatus;
  ownerType: VehicleOwnerType;
  shareholderId?: string;
  note?: string;
}

/**
 * Crée un engin. Unicité de plaque vérifiée côté applicatif (non bloquante,
 * cf. contrainte `prisma db push` : pas de @unique) : si doublon, l'engin est
 * créé quand même et `plateWarning` est renseigné pour que l'admin soit averti.
 */
export async function createVehicle(
  input: VehicleInput,
): Promise<{ vehicle: Vehicle; plateWarning: string | null }> {
  if (input.ownerType === 'actionnaire') {
    if (!input.shareholderId) {
      throw new HttpError(400, 'SHAREHOLDER_REQUIRED', 'Un engin d’actionnaire exige un actionnaire.');
    }
    await ensureShareholder(input.shareholderId);
  }

  let plateWarning: string | null = null;
  if (input.plate) {
    const dup = await prisma.vehicle.findFirst({
      where: { plate: input.plate },
      select: { id: true },
    });
    if (dup) plateWarning = `Un engin avec la plaque ${input.plate} existe déjà.`;
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      vehicleType: input.vehicleType,
      brand: input.brand,
      model: input.model,
      plate: input.plate,
      status: input.status ?? 'en_service',
      ownerType: input.ownerType,
      shareholderId: input.ownerType === 'actionnaire' ? input.shareholderId : null,
      note: input.note,
    },
  });
  return { vehicle, plateWarning };
}

export async function getVehicle(id: string): Promise<VehicleListRow> {
  const v = await prisma.vehicle.findUnique({
    where: { id },
    include: { shareholder: true, ...activeAssignmentInclude },
  });
  if (!v) throw new HttpError(404, 'NOT_FOUND', 'Engin introuvable');
  return toListRow(v as VehicleWithActive);
}

export async function updateVehicle(
  id: string,
  patch: Partial<VehicleInput>,
): Promise<Vehicle> {
  const current = await prisma.vehicle.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'NOT_FOUND', 'Engin introuvable');

  const ownerType = patch.ownerType ?? current.ownerType;
  let shareholderId = patch.shareholderId ?? current.shareholderId;
  if (ownerType === 'actionnaire') {
    if (!shareholderId) {
      throw new HttpError(400, 'SHAREHOLDER_REQUIRED', 'Un engin d’actionnaire exige un actionnaire.');
    }
    await ensureShareholder(shareholderId);
  } else {
    shareholderId = null;
  }

  return prisma.vehicle.update({
    where: { id },
    data: {
      vehicleType: patch.vehicleType,
      brand: patch.brand,
      model: patch.model,
      plate: patch.plate,
      status: patch.status,
      ownerType,
      shareholderId,
      note: patch.note,
    },
  });
}
