import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { validatePromoCtrl } from '../controllers/promo.controller.js';

const router = Router();

// Endpoint client : valide un code promo avant le submit de la livraison.
// Retourne le montant de remise applicable ou une erreur 400 si invalide.
router.post('/validate', authRequired, validatePromoCtrl);

export default router;
