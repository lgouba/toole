import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  getMe,
  updateMe,
  registerPushTokenCtrl,
  unregisterPushTokenCtrl,
} from '../controllers/users.controller.js';

const router = Router();

router.use(authRequired);
router.get('/me', getMe);
router.put('/me', updateMe);
router.post('/push-token', registerPushTokenCtrl);
router.delete('/push-token', unregisterPushTokenCtrl);

export default router;
