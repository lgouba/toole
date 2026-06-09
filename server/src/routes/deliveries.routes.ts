import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  createDeliveryCtrl,
  listDeliveriesCtrl,
  getDeliveryCtrl,
  getDeliveryRouteCtrl,
  acceptCtrl,
  rejectCtrl,
  pickupCtrl,
  validateCtrl,
  cancelCtrl,
  relaunchCtrl,
  rateCtrl,
  estimateCtrl,
} from '../controllers/deliveries.controller.js';

const router = Router();

// Public endpoint: price estimate
router.get('/estimate', estimateCtrl);

// Everything below requires auth
router.use(authRequired);

router.post('/', createDeliveryCtrl);
router.get('/', listDeliveriesCtrl);
router.get('/:id', getDeliveryCtrl);
router.get('/:id/route', getDeliveryRouteCtrl);
router.put('/:id/accept', acceptCtrl);
router.put('/:id/reject', rejectCtrl);
router.put('/:id/pickup-confirm', pickupCtrl);
router.put('/:id/validate-code', validateCtrl);
router.put('/:id/cancel', cancelCtrl);
router.put('/:id/relaunch', relaunchCtrl);
router.post('/:id/rate', rateCtrl);

export default router;
