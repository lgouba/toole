import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import {
  updateStatus,
  updateDriverLocation,
  getNearby,
  getDriver,
} from '../controllers/drivers.controller.js';

const router = Router();

// Public
router.get('/nearby', getNearby);
router.get('/:id', getDriver);

// Driver-only
router.put('/status', authRequired, requireRole('driver'), updateStatus);
router.put('/location', authRequired, requireRole('driver'), updateDriverLocation);

export default router;
