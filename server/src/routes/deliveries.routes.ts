import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
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
import {
  listMessagesCtrl,
  sendMessageCtrl,
  markReadCtrl,
  unreadCountCtrl,
} from '../controllers/messages.controller.js';

const router = Router();

// Public endpoint: price estimate
router.get('/estimate', estimateCtrl);

// Everything below requires auth
router.use(authRequired);

router.post('/', createDeliveryCtrl);
router.get('/', listDeliveriesCtrl);
router.get('/:id', getDeliveryCtrl);
router.get('/:id/route', getDeliveryRouteCtrl);
// Actions RESERVEES aux livreurs : accepter / refuser / confirmer le retrait /
// valider le code de livraison. Sans requireRole('driver'), n'importe quel
// compte client authentifie pouvait s'auto-assigner une course (BFLA) et, en
// creant sa propre course, fabriquer du solde retirable (self-dealing).
router.put('/:id/accept', requireRole('driver'), acceptCtrl);
router.put('/:id/reject', requireRole('driver'), rejectCtrl);
router.put('/:id/pickup-confirm', requireRole('driver'), pickupCtrl);
router.put('/:id/validate-code', requireRole('driver'), validateCtrl);
router.put('/:id/cancel', cancelCtrl);
router.put('/:id/relaunch', relaunchCtrl);
router.post('/:id/rate', rateCtrl);

// Messagerie in-app client <-> livreur (rattachee a la course)
router.get('/:id/messages', listMessagesCtrl);
router.get('/:id/messages/unread', unreadCountCtrl);
router.post('/:id/messages', sendMessageCtrl);
router.post('/:id/messages/read', markReadCtrl);

export default router;
