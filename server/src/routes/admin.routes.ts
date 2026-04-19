import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import {
  adminLoginCtrl,
  getMeAdminCtrl,
  statsCtrl,
  listUsersCtrl,
  getUserCtrl,
  suspendUserCtrl,
  reactivateUserCtrl,
  resetOtpCtrl,
  deleteUserCtrl,
  verifyDriverCtrl,
  listDeliveriesAdminCtrl,
  getDeliveryAdminCtrl,
  forceCancelDeliveryCtrl,
} from '../controllers/admin.controller.js';

const router = Router();

// Public login (admin)
router.post('/login', adminLoginCtrl);

// Toutes les autres routes exigent role admin
router.use(authRequired, requireRole('admin'));

router.get('/me', getMeAdminCtrl);
router.get('/stats', statsCtrl);

// Users
router.get('/users', listUsersCtrl);
router.get('/users/:id', getUserCtrl);
router.post('/users/:id/suspend', suspendUserCtrl);
router.post('/users/:id/reactivate', reactivateUserCtrl);
router.post('/users/:id/reset-otp', resetOtpCtrl);
router.delete('/users/:id', deleteUserCtrl);

// Driver KYC
router.post('/drivers/:id/verify', verifyDriverCtrl);

// Deliveries
router.get('/deliveries', listDeliveriesAdminCtrl);
router.get('/deliveries/:id', getDeliveryAdminCtrl);
router.post('/deliveries/:id/force-cancel', forceCancelDeliveryCtrl);

export default router;
