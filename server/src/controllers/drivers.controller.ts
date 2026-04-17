import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AuthedRequest } from '../middleware/auth.js';
import {
  setOnline,
  updateLocation,
  findNearbyDrivers,
  getPublicDriverProfile,
} from '../services/driver.service.js';
import { emitToUser } from '../services/notification.service.js';
import { success } from '../utils/response.js';

const statusSchema = z.object({ isOnline: z.boolean() });

export async function updateStatus(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { isOnline } = statusSchema.parse(req.body);
    const profile = await setOnline(req.user!.id, isOnline);
    return success(res, profile);
  } catch (err) {
    next(err);
  }
}

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function updateDriverLocation(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { latitude, longitude } = locationSchema.parse(req.body);
    const profile = await updateLocation(req.user!.id, latitude, longitude);
    // Emit to self (for any subscribers like clients watching active delivery)
    emitToUser(req.user!.id, 'delivery:driver_location', {
      driverId: req.user!.id,
      latitude,
      longitude,
      updatedAt: profile.lastLocationUpdate,
    });
    return success(res, profile);
  } catch (err) {
    next(err);
  }
}

const nearbySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusKm: z.coerce.number().min(0.1).max(50).default(5),
});

export async function getNearby(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { lat, lng, radiusKm } = nearbySchema.parse(req.query);
    const drivers = await findNearbyDrivers(lat, lng, radiusKm);
    return success(res, drivers);
  } catch (err) {
    next(err);
  }
}

export async function getDriver(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const driver = await getPublicDriverProfile(req.params.id);
    if (!driver) {
      return res
        .status(404)
        .json({ data: null, error: { code: 'NOT_FOUND', message: 'Driver not found' } });
    }
    return success(res, driver);
  } catch (err) {
    next(err);
  }
}
