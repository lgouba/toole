import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError, failure } from '../utils/response.js';
import { logger } from '../lib/logger.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return failure(
      res,
      {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten(),
      },
      422,
    );
  }

  if (err instanceof HttpError) {
    return failure(
      res,
      { code: err.code, message: err.message, details: err.details },
      err.status,
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return failure(
        res,
        {
          code: 'UNIQUE_CONSTRAINT',
          message: 'Resource already exists',
          details: err.meta,
        },
        409,
      );
    }
    if (err.code === 'P2025') {
      return failure(
        res,
        { code: 'NOT_FOUND', message: 'Resource not found' },
        404,
      );
    }
  }

  logger.error({ err }, 'Unhandled error');
  return failure(
    res,
    {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    500,
  );
}

export function notFoundHandler(_req: Request, res: Response) {
  return failure(res, { code: 'NOT_FOUND', message: 'Route not found' }, 404);
}
