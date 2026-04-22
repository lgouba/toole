import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthedRequest } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import * as adminService from '../services/admin.service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function adminLoginCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await adminService.adminLogin(email, password);
    return success(res, {
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        userType: result.user.userType,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMeAdminCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    return success(res, {
      id: req.user!.id,
      email: req.user!.email,
      fullName: req.user!.fullName,
      userType: req.user!.userType,
    });
  } catch (err) {
    next(err);
  }
}

export async function statsCtrl(
  _req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const stats = await adminService.getDashboardStats();
    return success(res, stats);
  } catch (err) {
    next(err);
  }
}

// ---------- Users ----------

const listUsersSchema = z.object({
  role: z.enum(['client', 'driver', 'merchant', 'admin']).optional(),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  take: z.coerce.number().min(1).max(200).default(50),
  skip: z.coerce.number().min(0).default(0),
});

export async function listUsersCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = listUsersSchema.parse(req.query);
    const result = await adminService.listUsers({
      role: q.role,
      search: q.search,
      isActive:
        q.isActive === 'true' ? true : q.isActive === 'false' ? false : undefined,
      take: q.take,
      skip: q.skip,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getUserCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await adminService.getUserDetail(req.params.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

const suspendSchema = z.object({ reason: z.string().max(500).optional() });

export async function suspendUserCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { reason } = suspendSchema.parse(req.body ?? {});
    const user = await adminService.setUserActive(req.params.id, false, reason);
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function reactivateUserCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await adminService.setUserActive(req.params.id, true);
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function resetOtpCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await adminService.resetUserOtp(req.params.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function deleteUserCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await adminService.deleteUser(req.params.id);
    return success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

// ---------- Location history ----------

const locationHistorySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().min(1).max(5000).optional(),
});

export async function getDriverLocationHistoryCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = locationHistorySchema.parse(req.query);
    const result = await adminService.getDriverLocationHistory(req.params.id, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      limit: q.limit,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// ---------- KYC ----------

const verifySchema = z.object({
  status: z.enum(['verified', 'rejected', 'pending']),
  note: z.string().max(500).optional(),
});

export async function verifyDriverCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = verifySchema.parse(req.body);
    const profile = await adminService.setDriverVerification(
      req.params.id,
      body.status,
      body.note,
    );
    return success(res, profile);
  } catch (err) {
    next(err);
  }
}

// ---------- Deliveries ----------

const listDeliveriesSchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  take: z.coerce.number().min(1).max(200).default(50),
  skip: z.coerce.number().min(0).default(0),
});

export async function listDeliveriesAdminCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = listDeliveriesSchema.parse(req.query);
    const result = await adminService.listDeliveries(q);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getDeliveryAdminCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const delivery = await adminService.getDeliveryDetail(req.params.id);
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}

const forceCancelSchema = z.object({ note: z.string().max(500).optional() });

export async function forceCancelDeliveryCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = forceCancelSchema.parse(req.body ?? {});
    const delivery = await adminService.forceCancelDelivery(
      req.params.id,
      body.note,
    );
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}
