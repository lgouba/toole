import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  getMyWalletCtrl,
  getMyTransactionsCtrl,
  sendWithdrawOtpCtrl,
  requestWithdrawCtrl,
  sendTopupOtpCtrl,
  requestTopupCtrl,
} from '../controllers/wallet.controller.js';

const router = Router();

router.use(authRequired);

// Lecture
router.get('/', getMyWalletCtrl);
router.get('/transactions', getMyTransactionsCtrl);

// Retrait (pour les gains wallet futurs)
router.post('/withdraw/otp', sendWithdrawOtpCtrl);
router.post('/withdraw', requestWithdrawCtrl);

// Topup (reglement de dette commission)
router.post('/topup/otp', sendTopupOtpCtrl);
router.post('/topup', requestTopupCtrl);

export default router;
