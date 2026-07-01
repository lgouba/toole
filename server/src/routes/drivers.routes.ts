import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import {
  updateStatus,
  updateDriverLocation,
  getNearby,
  getMapDrivers,
  getDriver,
  updateKyc,
  getKyc,
  getDriverStatsCtrl,
} from '../controllers/drivers.controller.js';

const router = Router();

// Recherche de livreurs proches (coords arrondies) : réservée aux comptes
// authentifiés (empêche le scraping anonyme de position/identité des livreurs).
router.get('/nearby', authRequired, getNearby);
// Carte d'accueil décorative : coords déjà arrondies (~110 m) + statut seul.
router.get('/map', getMapDrivers);

// Driver-only (place AVANT la route /:id pour ne pas etre capture)
router.put('/status', authRequired, requireRole('driver'), updateStatus);
router.put('/location', authRequired, requireRole('driver'), updateDriverLocation);
router.get('/me/kyc', authRequired, requireRole('driver'), getKyc);
router.put('/me/kyc', authRequired, requireRole('driver'), updateKyc);
router.get('/me/stats', authRequired, requireRole('driver'), getDriverStatsCtrl);

// Profil livreur (whitelist stricte, cf. getPublicDriverProfile) — authentifié.
// Doit rester APRÈS les routes spécifiques pour ne pas les capturer.
router.get('/:id', authRequired, getDriver);

export default router;
