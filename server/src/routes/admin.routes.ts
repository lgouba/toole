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
  getDriverLocationHistoryCtrl,
  getSettingsCtrl,
  updateSettingsCtrl,
  getDailyStatsCtrl,
  getHotZonesCtrl,
  listTransactionsCtrl,
  listPendingPayoutsCtrl,
  markWithdrawalPaidCtrl,
  rejectWithdrawalCtrl,
  confirmTopupCtrl,
  rejectTopupCtrl,
  adjustWalletCtrl,
  listDeliveriesAdminCtrl,
  getDeliveryAdminCtrl,
  forceCancelDeliveryCtrl,
  broadcastNotificationCtrl,
  listNotificationsCtrl,
} from '../controllers/admin.controller.js';
import {
  adminListPromoCtrl,
  adminCreatePromoCtrl,
  adminUpdatePromoCtrl,
  adminDeletePromoCtrl,
} from '../controllers/promo.controller.js';

const router = Router();

// Public login (admin)
router.post('/login', adminLoginCtrl);

// Toutes les autres routes exigent role admin
router.use(authRequired, requireRole('admin'));

router.get('/me', getMeAdminCtrl);
router.get('/stats', statsCtrl);
router.get('/stats/daily', getDailyStatsCtrl);
router.get('/stats/hotzones', getHotZonesCtrl);

// Users
router.get('/users', listUsersCtrl);
router.get('/users/:id', getUserCtrl);
router.post('/users/:id/suspend', suspendUserCtrl);
router.post('/users/:id/reactivate', reactivateUserCtrl);
router.post('/users/:id/reset-otp', resetOtpCtrl);
router.delete('/users/:id', deleteUserCtrl);

// Driver KYC
router.post('/drivers/:id/verify', verifyDriverCtrl);

// Driver tracking (position history for investigations)
router.get('/drivers/:id/location-history', getDriverLocationHistoryCtrl);

// Platform settings (singleton)
router.get('/settings', getSettingsCtrl);
router.put('/settings', updateSettingsCtrl);

// Transactions / payouts
router.get('/transactions', listTransactionsCtrl);
router.get('/payouts/pending', listPendingPayoutsCtrl);
router.post('/transactions/:id/mark-paid', markWithdrawalPaidCtrl);
router.post('/transactions/:id/reject', rejectWithdrawalCtrl);
router.post('/transactions/:id/confirm-topup', confirmTopupCtrl);
router.post('/transactions/:id/reject-topup', rejectTopupCtrl);
router.post('/users/:id/wallet-adjust', adjustWalletCtrl);

// Deliveries
router.get('/deliveries', listDeliveriesAdminCtrl);
router.get('/deliveries/:id', getDeliveryAdminCtrl);
router.post('/deliveries/:id/force-cancel', forceCancelDeliveryCtrl);

// Notifications push (broadcast)
router.get('/notifications', listNotificationsCtrl);
router.post('/notifications/broadcast', broadcastNotificationCtrl);

// Codes promo (Bundle 3)
router.get('/promo-codes', adminListPromoCtrl);
router.post('/promo-codes', adminCreatePromoCtrl);
router.put('/promo-codes/:id', adminUpdatePromoCtrl);
router.delete('/promo-codes/:id', adminDeletePromoCtrl);

export default router;
