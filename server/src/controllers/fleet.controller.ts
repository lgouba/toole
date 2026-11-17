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
