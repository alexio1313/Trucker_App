import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { recordLocationUpdate, getLiveTracking, setTruckerAvailability } from './tracking.service';

const router = Router();

const locationUpdateSchema = z.object({
  loadId: z.string(),
  truckId: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(200).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
});

router.post('/update', async (req: Request, res: Response): Promise<void> => {
  const parsed = locationUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid location data' } });
    return;
  }
  const truckerId = req.headers['x-user-id'] as string;
  await recordLocationUpdate({ ...parsed.data, truckerId });
  res.json({ success: true, data: null });
});

router.get('/:loadId/live', async (req: Request, res: Response): Promise<void> => {
  const state = await getLiveTracking(req.params.loadId);
  if (!state) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No live tracking data' } });
    return;
  }
  res.json({ success: true, data: state });
});

export { router as trackingRoutes };
