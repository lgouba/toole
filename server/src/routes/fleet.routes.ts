import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import {
  listShareholdersCtrl,
  createShareholderCtrl,
  getShareholderCtrl,
  updateShareholderCtrl,
  archiveShareholderCtrl,
  listVehiclesCtrl,
  createVehicleCtrl,
  getVehicleCtrl,
  updateVehicleCtrl,
  assignVehicleCtrl,
  unassignVehicleCtrl,
  listAssignableDriversCtrl,
  getVehicleReportCtrl,
  getShareholderReportCtrl,
  getShareholderReportCsvCtrl,
} from '../controllers/fleet.controller.js';

const router = Router();

// Toutes les routes du Parc Auto exigent le role admin.
router.use(authRequired, requireRole('admin'));

// Actionnaires
router.get('/shareholders', listShareholdersCtrl);
router.post('/shareholders', createShareholderCtrl);
router.get('/shareholders/:id', getShareholderCtrl);
router.patch('/shareholders/:id', updateShareholderCtrl);
router.post('/shareholders/:id/archive', archiveShareholderCtrl);
router.get('/shareholders/:id/report.csv', getShareholderReportCsvCtrl);
router.get('/shareholders/:id/report', getShareholderReportCtrl);

// Engins
router.get('/vehicles', listVehiclesCtrl);
router.post('/vehicles', createVehicleCtrl);
router.get('/vehicles/:id', getVehicleCtrl);
router.get('/vehicles/:id/report', getVehicleReportCtrl);
router.patch('/vehicles/:id', updateVehicleCtrl);
router.post('/vehicles/:id/assign', assignVehicleCtrl);
router.post('/vehicles/:id/unassign', unassignVehicleCtrl);

// Livreurs affectables (sélecteur d'affectation)
router.get('/drivers/assignable', listAssignableDriversCtrl);

export default router;
