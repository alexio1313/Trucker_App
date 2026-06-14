import { Router } from 'express';
import {
  handleCreateLoad,
  handleGetLoad,
  handleListLoads,
  handleSearchLoads,
  handleAcceptLoad,
  handleConfirmPickup,
  handleDeliverLoad,
  handleCancelLoad,
} from './load.controller';

const router = Router();

router.get('/search', handleSearchLoads);
router.get('/', handleListLoads);
router.post('/', handleCreateLoad);
router.get('/:loadId', handleGetLoad);
router.post('/:loadId/accept', handleAcceptLoad);
router.post('/:loadId/pickup', handleConfirmPickup);
router.post('/:loadId/deliver', handleDeliverLoad);
router.post('/:loadId/cancel', handleCancelLoad);

export { router as loadRoutes };
