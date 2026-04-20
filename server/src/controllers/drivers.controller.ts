import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import {
  setOnline,
  updateLocation,
  findNearbyDrivers,
  getPublicDriverProfile,
} from '../services/driver.service.js';
import { emitToUser } from '../services/notification.service.js';
import { success } from '../utils/response.js';
import { HttpError } from '../utils/response.js';

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
    const driverId = req.user!.id;
    const profile = await updateLocation(driverId, latitude, longitude);

    const payload = {
      driverId,
      latitude,
      longitude,
      updatedAt: profile.lastLocationUpdate,
    };

    // 1) Livreur lui-meme (pour les propres widgets en ecoute)
    emitToUser(driverId, 'delivery:driver_location', payload);

    // 2) Client de la course active s'il y en a une : il voit le livreur bouger live
    const activeDelivery = await prisma.delivery.findFirst({
      where: {
        driverId,
        status: {
          in: ['accepted', 'picking_up', 'picked_up', 'delivering'],
        },
      },
      select: { id: true, senderId: true },
    });

    if (activeDelivery) {
      emitToUser(activeDelivery.senderId, 'delivery:driver_location', {
        ...payload,
        deliveryId: activeDelivery.id,
      });
    }

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

const kycSchema = z.object({
  vehicleType: z.enum(['moto', 'velo', 'voiture', 'tricycle']).optional(),
  vehiclePlate: z.string().max(50).optional(),
  vehiclePhotoUrl: z.string().max(500).optional(),
  cnibNumber: z.string().max(50).optional(),
  cnibPhotoUrl: z.string().max(500).optional(),
  licenseNumber: z.string().max(50).optional(),
  licensePhotoUrl: z.string().max(500).optional(),
});

export async function updateKyc(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = kycSchema.parse(req.body);
    const profile = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!profile) throw new HttpError(404, 'NOT_FOUND', 'Driver profile not found');

    // Si le livreur soumet de nouveaux documents, repasser en "pending" pour re-validation
    const needsReview = Boolean(
      data.cnibPhotoUrl || data.licensePhotoUrl || data.vehiclePhotoUrl,
    );

    const updated = await prisma.driverProfile.update({
      where: { userId: req.user!.id },
      data: {
        ...data,
        ...(needsReview && profile.verificationStatus !== 'pending'
          ? { verificationStatus: 'pending', verifiedAt: null }
          : {}),
      },
    });
    return success(res, updated);
  } catch (err) {
    next(err);
  }
}

export async function getKyc(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!profile) throw new HttpError(404, 'NOT_FOUND', 'Driver profile not found');
    return success(res, profile);
  } catch (err) {
    next(err);
  }
}
