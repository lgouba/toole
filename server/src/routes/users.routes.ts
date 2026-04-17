import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { getMe, updateMe } from '../controllers/users.controller.js';

const router = Router();

router.use(authRequired);
router.get('/me', getMe);
router.put('/me', updateMe);

export default router;
