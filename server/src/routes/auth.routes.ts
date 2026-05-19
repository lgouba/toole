import { Router } from 'express';
import {
  sendOtpCtrl,
  verifyOtpCtrl,
  registerCtrl,
  refreshCtrl,
} from '../controllers/auth.controller.js';
import {
  otpByPhoneLimiter,
  otpByIpLimiter,
} from '../middleware/rateLimit.js';

const router = Router();

// Anti-spam OTP : double limiter (par numero + par IP).
// L'ordre compte : phone d'abord (plus precis), IP ensuite (filet de
// secours pour les attaques distribuees sur plusieurs numeros).
router.post('/send-otp', otpByPhoneLimiter, otpByIpLimiter, sendOtpCtrl);
router.post('/verify-otp', verifyOtpCtrl);
router.post('/register', registerCtrl);
router.post('/refresh', refreshCtrl);

export default router;
