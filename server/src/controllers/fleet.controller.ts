import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthedRequest } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import * as fleet from '../services/fleet.service.js';

const vehicleTypeEnum = z.enum(['moto', 'velo', 'voiture', 'tricycle']);
const vehicleStatusEnum = z.enum(['en_service', 'en_panne', 'retire']);
const ownerTypeEnum = z.enum(['actionnaire', 'toole']);

// ---------- Actionnaires ----------

const shareholderSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(200).optional(),
  note: z.string().max(1000).optional(),
});

export async function listShareholdersCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    return success(res, await fleet.listShareholders());
  } catch (err) {
    next(err);
  }
}

export async function createShareholderCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const input = shareholderSchema.parse(req.body ?? {});
    return success(res, await fleet.createShareholder(input), 201);
  } catch (err) {
    next(err);
  }
}

export async function getShareholderCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const shareholder = await fleet.getShareholder(req.params.id);
    const activity = await fleet.getShareholderActivity(req.params.id);
    return success(res, { shareholder, activity });
  } catch (err) {
    next(err);
  }
}

export async function updateShareholderCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const patch = shareholderSchema.partial().parse(req.body ?? {});
    return success(res, await fleet.updateShareholder(req.params.id, patch));
  } catch (err) {
    next(err);
  }
}

export async function archiveShareholderCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    return success(res, await fleet.archiveShareholder(req.params.id));
  } catch (err) {
    next(err);
  }
}

// ---------- Engins ----------

const listVehiclesQuery = z.object({
  status: vehicleStatusEnum.optional(),
  ownerType: ownerTypeEnum.optional(),
  assigned: z.enum(['true', 'false']).optional(),
});

export async function listVehiclesCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const q = listVehiclesQuery.parse(req.query);
    return success(
      res,
      await fleet.listVehicles({
        status: q.status,
        ownerType: q.ownerType,
        assigned: q.assigned === undefined ? undefined : q.assigned === 'true',
      }),
    );
  } catch (err) {
    next(err);
  }
}

const vehicleSchema = z.object({
  vehicleType: vehicleTypeEnum,
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  plate: z.string().max(30).optional(),
  status: vehicleStatusEnum.optional(),
  ownerType: ownerTypeEnum,
  shareholderId: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
});

export async function createVehicleCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const input = vehicleSchema.parse(req.body ?? {});
    const { vehicle, plateWarning } = await fleet.createVehicle(input);
    return success(res, { vehicle, plateWarning }, 201);
  } catch (err) {
    next(err);
  }
}

export async function getVehicleCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    return success(res, await fleet.getVehicleDetail(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function updateVehicleCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const patch = vehicleSchema.partial().parse(req.body ?? {});
    return success(res, await fleet.updateVehicle(req.params.id, patch));
  } catch (err) {
    next(err);
  }
}

// ---------- Affectations ----------

const assignSchema = z.object({
  driverId: z.string().uuid(),
  note: z.string().max(1000).optional(),
});

export async function assignVehicleCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { driverId, note } = assignSchema.parse(req.body ?? {});
    return success(res, await fleet.assignVehicle(req.params.id, driverId, note, req.user?.id));
  } catch (err) {
    next(err);
  }
}

export async function unassignVehicleCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    return success(res, await fleet.unassignVehicle(req.params.id, req.user?.id));
  } catch (err) {
    next(err);
  }
}

export async function listAssignableDriversCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    return success(res, await fleet.listAssignableDrivers());
  } catch (err) {
    next(err);
  }
}

// ---------- Reporting (Lot 2) ----------

const granularityEnum = z.enum(['day', 'month', 'year']);
const reportQuery = z.object({
  granularity: granularityEnum.optional(),
  from: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  to: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

/** Résout granularité + plage [from,to), avec défauts selon la granularité. */
function parseRange(raw: unknown): { granularity: 'day' | 'month' | 'year'; from: Date; to: Date } {
  const q = reportQuery.parse(raw);
  const granularity = q.granularity ?? 'day';
  const to = q.to ? new Date(q.to) : new Date();
  let from: Date;
  if (q.from) {
    from = new Date(q.from);
  } else {
    from = new Date(to);
    if (granularity === 'year') from.setUTCFullYear(from.getUTCFullYear() - 5);
    else if (granularity === 'month') from.setUTCMonth(from.getUTCMonth() - 12);
    else from.setUTCDate(from.getUTCDate() - 30);
  }
  return { granularity, from, to };
}

export async function getVehicleReportCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { granularity, from, to } = parseRange(req.query);
    return success(res, await fleet.getVehicleReport(req.params.id, granularity, from, to));
  } catch (err) {
    next(err);
  }
}

export async function getShareholderReportCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { granularity, from, to } = parseRange(req.query);
    return success(res, await fleet.getShareholderReport(req.params.id, granularity, from, to));
  } catch (err) {
    next(err);
  }
}

/** Échappe un champ CSV (guillemets + séparateur + retours ligne). */
function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function getShareholderReportCsvCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { granularity, from, to } = parseRange(req.query);
    const report = await fleet.getShareholderReport(req.params.id, granularity, from, to);
    const header = ['periode', 'courses', 'total_genere', 'gains_livreur'];
    const lines = [header.join(',')];
    for (const b of report.series) {
      lines.push([csvField(b.period), b.courses, b.totalGenere, b.gainsLivreur].join(','));
    }
    const csv = lines.join('\n') + '\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="releve-${req.params.id}-${granularity}.csv"`,
    );
    return res.send(csv);
  } catch (err) {
    next(err);
  }
}
