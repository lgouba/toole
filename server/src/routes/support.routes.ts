import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { supportCreateLimiter } from '../middleware/rateLimit.js';
import {
  createTicket,
  listMyTickets,
  getMyTicket,
} from '../controllers/support.controller.js';

const router = Router();

router.use(authRequired);
router.post('/tickets', supportCreateLimiter, createTicket);
router.get('/tickets', listMyTickets);
router.get('/tickets/:id', getMyTicket);

export default router;
