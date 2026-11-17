// Types & helpers partagés des écrans Parc Auto (DRY entre Fleet / VehicleDetail /
// Shareholders / ShareholderDetail). Reflètent les réponses de /api/admin/fleet.

export type VehicleType = 'moto' | 'velo' | 'voiture' | 'tricycle';
export type VehicleStatus = 'en_service' | 'en_panne' | 'retire';
export type VehicleOwnerType = 'actionnaire' | 'toole';

export interface Shareholder {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ActiveAssignment {
  id: string;
  driverId: string;
  driver: { id: string; fullName: string };
  startedAt: string;
}

export interface VehicleRow {
  id: string;
  vehicleType: VehicleType;
  brand: string | null;
  model: string | null;
  plate: string | null;
  photoUrl: string | null;
  status: VehicleStatus;
  ownerType: VehicleOwnerType;
  shareholderId: string | null;
  note: string | null;
  createdAt: string;
  shareholder: Shareholder | null;
  activeAssignment: ActiveAssignment | null;
}

export interface ActivityTotals {
  courses: number;
  totalGenere: number;
  gainsLivreur: number;
}

export interface AssignmentHistoryRow {
  id: string;
  driverId: string;
  driverName: string | null;
  startedAt: string;
  endedAt: string | null;
  note: string | null;
  totals: ActivityTotals;
}

export interface VehicleDetail extends VehicleRow {
  totals: ActivityTotals;
  history: AssignmentHistoryRow[];
}

export interface AssignableDriver {
  id: string;
  fullName: string;
  phone: string;
  hasActiveVehicle: boolean;
  activeVehicleLabel: string | null;
}

// ---------------------------------------------------------------------------
// Libellés & format
// ---------------------------------------------------------------------------

export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  moto: 'Moto',
  velo: 'Vélo',
  voiture: 'Voiture',
  tricycle: 'Tricycle',
};

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  en_service: 'En service',
  en_panne: 'En panne',
  retire: 'Retiré',
};

/** Classe de badge admin selon le statut (réutilise les badges existants). */
export function statusBadgeClass(status: VehicleStatus): string {
  switch (status) {
    case 'en_service':
      return 'badge badge-active';
    case 'en_panne':
      return 'badge badge-pending';
    case 'retire':
      return 'badge badge-suspended';
  }
}

export function vehicleLabel(v: Pick<VehicleRow, 'brand' | 'model' | 'plate'>): string {
  const name = [v.brand, v.model].filter(Boolean).join(' ').trim();
  if (name && v.plate) return `${name} · ${v.plate}`;
  return name || v.plate || 'Engin';
}

export function ownerLabel(v: Pick<VehicleRow, 'ownerType' | 'shareholder'>): string {
  if (v.ownerType === 'toole') return 'Toolé (parc propre)';
  return v.shareholder?.fullName ?? 'Actionnaire';
}

/** Formate un montant FCFA (séparateurs d'espace). */
export function fmtFcfa(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ')} FCFA`;
}

// ---------------------------------------------------------------------------
// Reporting (Lot 2)
// ---------------------------------------------------------------------------

export type Granularity = 'day' | 'month' | 'year';

export interface ReportBucket {
  period: string; // 'YYYY-MM-DD'
  courses: number;
  totalGenere: number;
  gainsLivreur: number;
}

export interface VehicleReport {
  series: ReportBucket[];
  totals: ActivityTotals;
}

export interface ShareholderReport {
  series: ReportBucket[];
  totals: ActivityTotals;
  vehicles: Array<{ id: string; label: string; plate: string | null; totals: ActivityTotals }>;
}

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  day: 'Jour',
  month: 'Mois',
  year: 'Année',
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Plage par défaut selon la granularité (30 jours / 12 mois / 5 ans). */
export function defaultRange(g: Granularity): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (g === 'year') from.setUTCFullYear(from.getUTCFullYear() - 5);
  else if (g === 'month') from.setUTCMonth(from.getUTCMonth() - 12);
  else from.setUTCDate(from.getUTCDate() - 30);
  return { from: ymd(from), to: ymd(to) };
}

/** Libellé d'axe selon la granularité. */
export function periodLabel(period: string, g: Granularity): string {
  const d = new Date(period);
  if (g === 'year') return String(d.getUTCFullYear());
  if (g === 'month')
    return d.toLocaleDateString('fr-FR', { month: '2-digit', year: '2-digit', timeZone: 'UTC' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}
