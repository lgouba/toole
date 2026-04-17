import { Router } from 'express';
import {
  sendOtpCtrl,
  verifyOtpCtrl,
  registerCtrl,
  refreshCtrl,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/send-otp', sendOtpCtrl);
router.post('/verify-otp', verifyOtpCtrl);
router.post('/register', registerCtrl);
router.post('/refresh', refreshCtrl);

export default router;
