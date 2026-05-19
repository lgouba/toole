import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { validatePromoCtrl } from '../controllers/promo.controller.js';
import { promoLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Endpoint client : valide un code promo avant le submit de la livraison.
// Rate-limit contre le brute-force de codes (un attaquant pourrait tester
// des milliers de combinaisons pour deviner un code valide).
router.post('/validate', promoLimiter, authRequired, validatePromoCtrl);

export default router;
