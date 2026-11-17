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

export async function listVehicles(
  filter: VehicleFilter = {},
): Promise<Array<VehicleListRow & { totals: ActivityTotals }>> {
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

  // Cumul à vie attaché à chaque engin (N+1 assumé : parc de taille modeste).
  const out: Array<VehicleListRow & { totals: ActivityTotals }> = [];
  for (const r of rows) {
    const base = toListRow(r as VehicleWithActive);
    out.push({ ...base, totals: await getVehicleActivity(base.id) });
  }
  return out;
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

// ---------------------------------------------------------------------------
// Affectations
// ---------------------------------------------------------------------------

function vehicleLabel(v: { brand: string | null; model: string | null; plate: string | null }): string {
  const name = [v.brand, v.model].filter(Boolean).join(' ').trim();
  if (name && v.plate) return `${name} · ${v.plate}`;
  return name || v.plate || 'engin';
}

/**
 * Affecte un engin `en_service` à un livreur. Clôt (dans une transaction)
 * toute affectation active de cet engin ET toute affectation active du livreur,
 * puis crée la nouvelle. Garantit l'invariant « au plus une affectation active
 * par engin et par livreur ».
 */
export async function assignVehicle(
  vehicleId: string,
  driverId: string,
  note?: string,
  adminId?: string,
) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new HttpError(404, 'NOT_FOUND', 'Engin introuvable');
  if (vehicle.status !== 'en_service') {
    throw new HttpError(
      409,
      'VEHICLE_NOT_ASSIGNABLE',
      'Seul un engin en service peut être affecté.',
    );
  }

  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      userType: true,
      isActive: true,
      suspendedAt: true,
      driverProfile: { select: { verificationStatus: true } },
    },
  });
  if (!driver || driver.userType !== 'driver') {
    throw new HttpError(404, 'NOT_FOUND', 'Livreur introuvable');
  }
  // L'invariant d'éligibilité vit dans le service (le filtre UI ne suffit pas :
  // appel API direct, ou livreur suspendu entre le listing et l'affectation).
  if (
    !driver.isActive ||
    driver.suspendedAt ||
    driver.driverProfile?.verificationStatus !== 'verified'
  ) {
    throw new HttpError(
      409,
      'DRIVER_NOT_ASSIGNABLE',
      'Ce livreur n’est pas affectable (non vérifié, inactif ou suspendu).',
    );
  }

  // Serializable : empêche deux `assign` concurrents de créer chacun une
  // affectation active (updateMany ne voit pas le create non committé de l'autre
  // sous Read Committed). L'une des deux transactions échouera et sera à rejouer.
  return prisma.$transaction(
    async (tx) => {
      const now = new Date();
      await tx.vehicleAssignment.updateMany({
        where: { vehicleId, endedAt: null },
        data: { endedAt: now, endedBy: adminId ?? null },
      });
      await tx.vehicleAssignment.updateMany({
        where: { driverId, endedAt: null },
        data: { endedAt: now, endedBy: adminId ?? null },
      });
      return tx.vehicleAssignment.create({
        data: { vehicleId, driverId, note: note ?? null },
        include: { driver: { select: { id: true, fullName: true } } },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** Clôt l'affectation active d'un engin. 404 si aucune. */
export async function unassignVehicle(vehicleId: string, adminId?: string) {
  const active = await prisma.vehicleAssignment.findFirst({
    where: { vehicleId, endedAt: null },
  });
  if (!active) throw new HttpError(404, 'NO_ACTIVE_ASSIGNMENT', 'Aucune affectation active sur cet engin.');
  return prisma.vehicleAssignment.update({
    where: { id: active.id },
    data: { endedAt: new Date(), endedBy: adminId ?? null },
  });
}

export interface AssignableDriver {
  id: string;
  fullName: string;
  phone: string;
  hasActiveVehicle: boolean;
  activeVehicleLabel: string | null;
}

/** Livreurs affectables : vérifiés, actifs, non suspendus. */
export async function listAssignableDrivers(): Promise<AssignableDriver[]> {
  const drivers = await prisma.user.findMany({
    where: {
      userType: 'driver',
      isActive: true,
      suspendedAt: null,
      driverProfile: { verificationStatus: 'verified' },
    },
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      fullName: true,
      phone: true,
      vehicleAssignments: {
        where: { endedAt: null },
        take: 1,
        include: { vehicle: { select: { brand: true, model: true, plate: true } } },
      },
    },
  });

  return drivers.map((d) => {
    const active = d.vehicleAssignments[0];
    return {
      id: d.id,
      fullName: d.fullName,
      phone: d.phone,
      hasActiveVehicle: Boolean(active),
      activeVehicleLabel: active ? vehicleLabel(active.vehicle) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Activité (lecture seule — agrégation des Delivery existantes)
// ---------------------------------------------------------------------------

export interface ActivityTotals {
  courses: number;
  totalGenere: number; // Σ price des courses livrées
  gainsLivreur: number; // Σ driverCommission (contexte)
}

const EMPTY: ActivityTotals = { courses: 0, totalGenere: 0, gainsLivreur: 0 };

function addTotals(a: ActivityTotals, b: ActivityTotals): ActivityTotals {
  return {
    courses: a.courses + b.courses,
    totalGenere: a.totalGenere + b.totalGenere,
    gainsLivreur: a.gainsLivreur + b.gainsLivreur,
  };
}

/** Agrège les courses LIVRÉES d'un livreur sur une fenêtre [from, to). */
async function aggregateForDriverWindow(
  driverId: string,
  from: Date,
  to: Date,
): Promise<ActivityTotals> {
  const r = await prisma.delivery.aggregate({
    where: { driverId, status: 'delivered', deliveredAt: { gte: from, lt: to } },
    _count: { _all: true },
    _sum: { price: true, driverCommission: true },
  });
  return {
    courses: r._count._all,
    totalGenere: r._sum.price ?? 0,
    gainsLivreur: r._sum.driverCommission ?? 0,
  };
}

/** Totaux d'une affectation précise (fenêtre [startedAt, endedAt ?? now)). */
export async function getAssignmentActivity(assignmentId: string): Promise<ActivityTotals> {
  const a = await prisma.vehicleAssignment.findUnique({ where: { id: assignmentId } });
  if (!a) throw new HttpError(404, 'NOT_FOUND', 'Affectation introuvable');
  return aggregateForDriverWindow(a.driverId, a.startedAt, a.endedAt ?? new Date());
}

/** Cumul à vie d'un engin : somme sur toutes ses affectations. */
export async function getVehicleActivity(vehicleId: string): Promise<ActivityTotals> {
  const assignments = await prisma.vehicleAssignment.findMany({ where: { vehicleId } });
  const now = new Date();
  let totals = EMPTY;
  for (const a of assignments) {
    const t = await aggregateForDriverWindow(a.driverId, a.startedAt, a.endedAt ?? now);
    totals = addTotals(totals, t);
  }
  return totals;
}

/** Cumul d'un actionnaire : somme sur ses engins. */
export async function getShareholderActivity(shareholderId: string): Promise<ActivityTotals> {
  const vehicles = await prisma.vehicle.findMany({
    where: { shareholderId },
    select: { id: true },
  });
  let totals = EMPTY;
  for (const v of vehicles) {
    totals = addTotals(totals, await getVehicleActivity(v.id));
  }
  return totals;
}

export type VehicleDetail = VehicleListRow & {
  totals: ActivityTotals;
  history: Array<{
    id: string;
    driverId: string;
    driverName: string | null;
    startedAt: Date;
    endedAt: Date | null;
    note: string | null;
    totals: ActivityTotals;
  }>;
};

/** Fiche engin complète : infos + proprio + affectation active + historique
 *  (avec totaux par affectation) + cumul à vie. */
export async function getVehicleDetail(id: string): Promise<VehicleDetail> {
  const base = await getVehicle(id); // 404 si absent, inclut shareholder + activeAssignment
  const assignments = await prisma.vehicleAssignment.findMany({
    where: { vehicleId: id },
    orderBy: { startedAt: 'desc' },
    include: { driver: { select: { id: true, fullName: true } } },
  });

  const now = new Date();
  const history = [];
  let totals = EMPTY;
  for (const a of assignments) {
    const t = await aggregateForDriverWindow(a.driverId, a.startedAt, a.endedAt ?? now);
    totals = addTotals(totals, t);
    history.push({
      id: a.id,
      driverId: a.driverId,
      driverName: a.driver?.fullName ?? null,
      startedAt: a.startedAt,
      endedAt: a.endedAt,
      note: a.note,
      totals: t,
    });
  }

  return { ...base, totals, history };
}

// ---------------------------------------------------------------------------
// Reporting Lot 2 — séries temporelles (lecture seule)
// ---------------------------------------------------------------------------

export type Granularity = 'day' | 'month' | 'year';

export interface ReportBucket {
  period: string; // 'YYYY-MM-DD' (début du bucket, UTC)
  courses: number;
  totalGenere: number;
  gainsLivreur: number;
}

type BucketVal = { courses: number; totalGenere: number; gainsLivreur: number };

/** Début de bucket en UTC (aligne le remplissage des trous sur date_trunc). */
function truncUTC(d: Date, g: Granularity): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (g === 'year') return new Date(Date.UTC(y, 0, 1));
  if (g === 'month') return new Date(Date.UTC(y, m, 1));
  return new Date(Date.UTC(y, m, day));
}

function advanceUTC(d: Date, g: Granularity): Date {
  const n = new Date(d);
  if (g === 'year') n.setUTCFullYear(n.getUTCFullYear() + 1);
  else if (g === 'month') n.setUTCMonth(n.getUTCMonth() + 1);
  else n.setUTCDate(n.getUTCDate() + 1);
  return n;
}

function bucketKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addBucket(a: BucketVal, b: BucketVal): BucketVal {
  return {
    courses: a.courses + b.courses,
    totalGenere: a.totalGenere + b.totalGenere,
    gainsLivreur: a.gainsLivreur + b.gainsLivreur,
  };
}

/**
 * Courses livrées d'un livreur groupées par bucket (date_trunc) sur [from,to).
 * NB : `Delivery.deliveredAt` est un `timestamp without time zone` et Prisma
 * normalise ces valeurs en UTC. `date_trunc` ignore donc le fuseau de session,
 * et les clés de bucket (ISO/UTC) s'alignent avec le comblage JS (truncUTC).
 * Si un jour `deliveredAt` passe en `@db.Timestamptz`, revérifier cet alignement.
 */
async function seriesForDriverWindow(
  driverId: string,
  from: Date,
  to: Date,
  granularity: Granularity,
): Promise<Map<string, BucketVal>> {
  const rows = await prisma.$queryRaw<
    { bucket: Date; courses: bigint; total: bigint | null; gains: bigint | null }[]
  >`
    SELECT
      date_trunc(${granularity}, "deliveredAt") AS bucket,
      COUNT(*) AS courses,
      SUM("price") AS total,
      SUM("driverCommission") AS gains
    FROM "Delivery"
    WHERE "driverId" = ${driverId}::uuid
      AND status = 'delivered'
      AND "deliveredAt" >= ${from}
      AND "deliveredAt" < ${to}
    GROUP BY 1
  `;
  const map = new Map<string, BucketVal>();
  for (const r of rows) {
    map.set(bucketKey(new Date(r.bucket)), {
      courses: Number(r.courses),
      totalGenere: Number(r.total ?? 0),
      gainsLivreur: Number(r.gains ?? 0),
    });
  }
  return map;
}

/** Map de buckets pour un engin : fusion de ses affectations bornées à [from,to). */
async function vehicleBucketMap(
  vehicleId: string,
  from: Date,
  to: Date,
  granularity: Granularity,
): Promise<Map<string, BucketVal>> {
  const assignments = await prisma.vehicleAssignment.findMany({
    where: { vehicleId, startedAt: { lt: to }, OR: [{ endedAt: null }, { endedAt: { gt: from } }] },
  });
  const now = new Date();
  const merged = new Map<string, BucketVal>();
  for (const a of assignments) {
    const wFrom = a.startedAt > from ? a.startedAt : from;
    const end = a.endedAt ?? now;
    const wTo = end < to ? end : to;
    if (wFrom >= wTo) continue;
    const part = await seriesForDriverWindow(a.driverId, wFrom, wTo, granularity);
    for (const [k, v] of part) merged.set(k, merged.has(k) ? addBucket(merged.get(k)!, v) : v);
  }
  return merged;
}

/** Comble tous les buckets de [from,to) à 0 et trie croissant. */
function fillSeries(map: Map<string, BucketVal>, from: Date, to: Date, g: Granularity): ReportBucket[] {
  const series: ReportBucket[] = [];
  let cur = truncUTC(from, g);
  const end = to;
  while (cur < end) {
    const key = bucketKey(cur);
    const v = map.get(key) ?? { courses: 0, totalGenere: 0, gainsLivreur: 0 };
    series.push({ period: key, ...v });
    cur = advanceUTC(cur, g);
  }
  return series;
}

function sumBuckets(map: Map<string, BucketVal>): ActivityTotals {
  let t: ActivityTotals = { courses: 0, totalGenere: 0, gainsLivreur: 0 };
  for (const v of map.values()) t = addTotals(t, v);
  return t;
}

export async function getVehicleReport(
  vehicleId: string,
  granularity: Granularity,
  from: Date,
  to: Date,
): Promise<{ series: ReportBucket[]; totals: ActivityTotals }> {
  const map = await vehicleBucketMap(vehicleId, from, to, granularity);
  return { series: fillSeries(map, from, to, granularity), totals: sumBuckets(map) };
}

export async function getShareholderReport(
  shareholderId: string,
  granularity: Granularity,
  from: Date,
  to: Date,
): Promise<{
  series: ReportBucket[];
  totals: ActivityTotals;
  vehicles: Array<{ id: string; label: string; plate: string | null; totals: ActivityTotals }>;
}> {
  const vehicles = await prisma.vehicle.findMany({
    where: { shareholderId },
    select: { id: true, brand: true, model: true, plate: true },
  });
  const merged = new Map<string, BucketVal>();
  const perVehicle: Array<{ id: string; label: string; plate: string | null; totals: ActivityTotals }> = [];
  for (const v of vehicles) {
    const map = await vehicleBucketMap(v.id, from, to, granularity);
    for (const [k, val] of map) merged.set(k, merged.has(k) ? addBucket(merged.get(k)!, val) : val);
    perVehicle.push({ id: v.id, label: vehicleLabel(v), plate: v.plate, totals: sumBuckets(map) });
  }
  return {
    series: fillSeries(merged, from, to, granularity),
    totals: sumBuckets(merged),
    vehicles: perVehicle,
  };
}
