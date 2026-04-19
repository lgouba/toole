import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  getMe,
  updateMe,
  deleteMe,
  registerPushTokenCtrl,
  unregisterPushTokenCtrl,
} from '../controllers/users.controller.js';

const router = Router();

router.use(authRequired);
router.get('/me', getMe);
router.put('/me', updateMe);
router.delete('/me', deleteMe);
router.post('/push-token', registerPushTokenCtrl);
router.delete('/push-token', unregisterPushTokenCtrl);

export default router;
