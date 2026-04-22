import { Router } from 'express';
import { getPublicSettingsCtrl } from '../controllers/settings.controller.js';

const router = Router();

// Endpoint public (consomme par le mobile au demarrage)
router.get('/', getPublicSettingsCtrl);

export default router;
