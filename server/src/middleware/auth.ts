import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import { HttpError } from '../utils/response.js';
import { prisma } from '../lib/prisma.js';
import { User } from '@prisma/client';
import { extractAuthToken } from '../lib/authToken.js';

export interface AuthedRequest extends Request {
  user?: User;
  auth?: { userId: string; userType: string };
}

export async function authRequired(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    // Compat ascendante : header `Authorization: Bearer` PRIORITAIRE, sinon
    // cookie HttpOnly `toole_admin_token`. Tant que l'admin envoie le header,
    // le cookie n'est jamais utilisé. Cf. lib/authToken.ts.
    const token = extractAuthToken(req.headers.authorization, req.cookies);
    if (!token) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Missing Authorization header');
    }
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or inactive user');
    }
    req.user = user;
    req.auth = { userId: payload.userId, userType: payload.userType };
    next();
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    return next(new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
    }
    if (!roles.includes(req.user.userType)) {
      return next(
        new HttpError(403, 'FORBIDDEN', `Requires role: ${roles.join(', ')}`),
      );
    }
    next();
  };
}
