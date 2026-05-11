import { Router } from 'express';
import { publicTrackCtrl } from '../controllers/deliveries.controller.js';

/**
 * Routes PUBLIQUES de suivi destinataire (sans authentification).
 * Le token est cree a la creation de la livraison et partage par le client
 * au destinataire (SMS, WhatsApp...). Le destinataire ouvre la page web
 * /track/<token> qui interroge cet endpoint en polling pour suivre la
 * progression en temps reel.
 */
const router = Router();

router.get('/:token', publicTrackCtrl);

export default router;
