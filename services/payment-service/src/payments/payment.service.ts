import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../logger';
import { query, queryOne, withTransaction } from '../db/postgres';

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

interface DbPayment {
  payment_id: string;
  load_id: string;
  merchant_id: string;
  trucker_id: string;
  amount: number;
  platform_commission: number;
  net_trucker_amount: number;
  status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_payout_id: string | null;
  settlement_due_at: Date;
  settled_at: Date | null;
  created_at: Date;
}

export async function initiatePayment(
  loadId: string,
  merchantId: string,
  truckerId: string,
  agreedPrice: number,
): Promise<{ orderId: string; amount: number; currency: string }> {
  const existingPayment = await queryOne<DbPayment>(
    'SELECT * FROM payments WHERE load_id = $1',
    [loadId],
  );
  if (existingPayment) throw new Error('PAYMENT_ALREADY_EXISTS');

  const commissionAmount = Math.round((agreedPrice * env.PLATFORM_COMMISSION_PERCENT) / 100);
  const netTruckerAmount = agreedPrice - commissionAmount;

  // Create Razorpay order (amount in paise)
  const order = await razorpay.orders.create({
    amount: agreedPrice * 100,
    currency: 'INR',
    receipt: loadId,
    notes: { loadId, merchantId, truckerId },
  });

  const settlementDue = new Date(Date.now() + env.SETTLEMENT_DELAY_HOURS * 60 * 60 * 1000);

  await query(
    `INSERT INTO payments
     (load_id, merchant_id, trucker_id, amount, platform_commission, net_trucker_amount,
      status, razorpay_order_id, settlement_due_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)`,
    [loadId, merchantId, truckerId, agreedPrice, commissionAmount, netTruckerAmount, order.id, settlementDue],
  );

  logger.info('Payment initiated', { loadId, orderId: order.id, amount: agreedPrice });
  return { orderId: order.id as string, amount: agreedPrice, currency: 'INR' };
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function handlePaymentCaptured(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE payments SET status = 'captured', razorpay_payment_id = $2, updated_at = NOW()
       WHERE razorpay_order_id = $1`,
      [razorpayOrderId, razorpayPaymentId],
    );

    await client.query(
      `UPDATE loads SET agreed_price = (
         SELECT amount FROM payments WHERE razorpay_order_id = $1
       ) WHERE load_id = (
         SELECT load_id FROM payments WHERE razorpay_order_id = $1
       )`,
      [razorpayOrderId],
    );
  });

  logger.info('Payment captured', { razorpayOrderId, razorpayPaymentId });
}

export async function processSettlement(paymentId: string): Promise<void> {
  const payment = await queryOne<DbPayment>(
    `SELECT * FROM payments WHERE payment_id = $1 AND status = 'captured'
     AND settlement_due_at <= NOW()`,
    [paymentId],
  );
  if (!payment) throw new Error('PAYMENT_NOT_ELIGIBLE_FOR_SETTLEMENT');

  // Get trucker bank account
  const trucker = await queryOne<{ bank_account: string }>(
    'SELECT bank_account FROM users WHERE user_id = $1',
    [payment.trucker_id],
  );
  if (!trucker?.bank_account) throw new Error('TRUCKER_BANK_ACCOUNT_MISSING');

  // In production: trigger Razorpay Payout API
  // const payout = await razorpay.payouts.create({ ... });
  const mockPayoutId = `pout_${Date.now()}`;

  await query(
    `UPDATE payments SET status = 'settled', razorpay_payout_id = $2,
     settled_at = NOW(), updated_at = NOW() WHERE payment_id = $1`,
    [paymentId, mockPayoutId],
  );

  logger.info('Payment settled', { paymentId, truckerId: payment.trucker_id, amount: payment.net_trucker_amount });
}

export async function getPaymentHistory(
  userId: string,
  userType: string,
  page: number,
  pageSize: number,
): Promise<DbPayment[]> {
  const offset = (page - 1) * pageSize;
  const field = userType === 'merchant' ? 'merchant_id' : 'trucker_id';
  return query<DbPayment>(
    `SELECT * FROM payments WHERE ${field} = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, pageSize, offset],
  );
}

export async function getPendingSettlements(): Promise<DbPayment[]> {
  return query<DbPayment>(
    `SELECT * FROM payments WHERE status = 'captured' AND settlement_due_at <= NOW()`,
  );
}
