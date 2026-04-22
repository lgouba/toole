import { Request, Response, NextFunction } from 'express';
import { getAppSettings, publicSettings } from '../services/settings.service.js';
import { success } from '../utils/response.js';

/** Endpoint public consomme par le mobile au demarrage. */
export async function getPublicSettingsCtrl(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const s = await getAppSettings();
    return success(res, publicSettings(s));
  } catch (err) {
    next(err);
  }
}
