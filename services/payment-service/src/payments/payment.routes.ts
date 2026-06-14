import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  initiatePayment,
  verifyWebhookSignature,
  handlePaymentCaptured,
  getPaymentHistory,
  getPendingSettlements,
  processSettlement,
} from './payment.service';
import { logger } from '../logger';

const router = Router();

const initiateSchema = z.object({
  loadId: z.string(),
  merchantId: z.string(),
  truckerId: z.string(),
  agreedPrice: z.number().positive().max(10000000),
});

router.post('/initiate', async (req: Request, res: Response): Promise<void> => {
  const parsed = initiateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    return;
  }
  try {
    const result = await initiatePayment(
      parsed.data.loadId, parsed.data.merchantId,
      parsed.data.truckerId, parsed.data.agreedPrice,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    const code = (err as Error).message;
    res.status(code === 'PAYMENT_ALREADY_EXISTS' ? 409 : 500).json({
      success: false, error: { code, message: code.toLowerCase().replace(/_/g, ' ') },
    });
  }
});

// Razorpay webhook — raw body needed for signature verification
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = JSON.stringify(req.body);

  if (!verifyWebhookSignature(rawBody, signature)) {
    res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature mismatch' } });
    return;
  }

  const event = req.body as { event: string; payload: { payment: { entity: { order_id: string; id: string } } } };
  try {
    if (event.event === 'payment.captured') {
      await handlePaymentCaptured(
        event.payload.payment.entity.order_id,
        event.payload.payment.entity.id,
      );
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook handler failed', { error: (err as Error).message });
    res.status(500).json({ received: false });
  }
});

router.get('/history', async (req: Request, res: Response): Promise<void> => {
  const userId = req.headers['x-user-id'] as string;
  const userType = req.headers['x-user-type'] as string;
  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = Math.min(parseInt(req.query['pageSize'] as string) || 20, 50);
  const payments = await getPaymentHistory(userId, userType, page, pageSize);
  res.json({ success: true, data: { items: payments } });
});

// Internal — triggered by cron job for settlement processing
router.post('/payout/process', async (_req: Request, res: Response): Promise<void> => {
  const pending = await getPendingSettlements();
  const results = await Promise.allSettled(
    pending.map((p) => processSettlement(p.payment_id)),
  );
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  res.json({ success: true, data: { processed: pending.length, succeeded, failed } });
});

export { router as paymentRoutes };
