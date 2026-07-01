import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { walletMoneyLimiter } from '../middleware/rateLimit.js';
import {
  getMyWalletCtrl,
  getMyTransactionsCtrl,
  sendWithdrawOtpCtrl,
  requestWithdrawCtrl,
  sendTopupOtpCtrl,
  requestTopupCtrl,
  requestCashTopupCtrl,
} from '../controllers/wallet.controller.js';

const router = Router();

router.use(authRequired);

// Lecture
router.get('/', getMyWalletCtrl);
router.get('/transactions', getMyTransactionsCtrl);

// Opérations argent : rate-limitées par utilisateur (anti-spam OTP + abus).
// Retrait (pour les gains wallet futurs)
router.post('/withdraw/otp', walletMoneyLimiter, sendWithdrawOtpCtrl);
router.post('/withdraw', walletMoneyLimiter, requestWithdrawCtrl);

// Topup (reglement de dette commission)
router.post('/topup/otp', walletMoneyLimiter, sendTopupOtpCtrl);
router.post('/topup', walletMoneyLimiter, requestTopupCtrl);
router.post('/topup/cash', walletMoneyLimiter, requestCashTopupCtrl);

export default router;
