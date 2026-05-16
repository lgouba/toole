import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import {
  updateStatus,
  updateDriverLocation,
  getNearby,
  getDriver,
  updateKyc,
  getKyc,
  getDriverStatsCtrl,
} from '../controllers/drivers.controller.js';

const router = Router();

// Public
router.get('/nearby', getNearby);

// Driver-only (place AVANT la route /:id pour ne pas etre capture)
router.put('/status', authRequired, requireRole('driver'), updateStatus);
router.put('/location', authRequired, requireRole('driver'), updateDriverLocation);
router.get('/me/kyc', authRequired, requireRole('driver'), getKyc);
router.put('/me/kyc', authRequired, requireRole('driver'), updateKyc);
router.get('/me/stats', authRequired, requireRole('driver'), getDriverStatsCtrl);

// Public (doit rester apres les routes specifiques)
router.get('/:id', getDriver);

export default router;
