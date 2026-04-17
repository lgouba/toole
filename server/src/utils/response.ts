import { Response } from 'express';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function success<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data, error: null });
}

export function failure(
  res: Response,
  error: ApiError,
  status = 400,
) {
  return res.status(status).json({ data: null, error });
}

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
