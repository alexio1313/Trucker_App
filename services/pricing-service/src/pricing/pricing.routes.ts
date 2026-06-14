import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generatePriceQuote } from './pricing.service';
import { calculateSurgeMultiplier } from './surge.service';

const router = Router();

const quoteSchema = z.object({
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  originCity: z.string(),
  destLat: z.number().min(-90).max(90),
  destLng: z.number().min(-180).max(180),
  destCity: z.string(),
  cargoWeightKg: z.number().positive(),
  cargoType: z.string(),
  truckType: z.string(),
  pickupStart: z.string().datetime(),
});

router.post('/quote', async (req: Request, res: Response): Promise<void> => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten().fieldErrors } });
    return;
  }
  try {
    const quote = await generatePriceQuote(parsed.data);
    res.json({ success: true, data: quote });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'QUOTE_FAILED', message: (err as Error).message } });
  }
});

router.get('/surge', async (req: Request, res: Response): Promise<void> => {
  const { originCity, destinationCity, cargoType } = req.query;
  if (!originCity || !destinationCity) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'originCity and destinationCity required' } });
    return;
  }
  const surge = await calculateSurgeMultiplier(
    originCity as string,
    destinationCity as string,
    (cargoType as string) ?? 'general',
  );
  res.json({ success: true, data: surge });
});

export { router as pricingRoutes };
