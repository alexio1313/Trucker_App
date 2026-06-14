import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../logger';
import { sendFcmNotification } from '../dispatchers/fcm.dispatcher';
import { sendSms } from '../dispatchers/sms.dispatcher';

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: env.KAFKA_BROKERS.split(','),
});

const pool = new Pool({ connectionString: env.DATABASE_URL });

const TOPICS = [
  'load.created',
  'load.accepted',
  'load.pickup_started',
  'load.delivered',
  'load.cancelled',
];

async function getUserFcmToken(userId: string): Promise<string | null> {
  const result = await pool.query<{ fcm_token: string | null; phone_number: string }>(
    'SELECT fcm_token, phone_number FROM users WHERE user_id = $1',
    [userId],
  );
  return result.rows[0]?.fcm_token ?? null;
}

async function getUserPhone(userId: string): Promise<string | null> {
  const result = await pool.query<{ phone_number: string }>(
    'SELECT phone_number FROM users WHERE user_id = $1',
    [userId],
  );
  return result.rows[0]?.phone_number ?? null;
}

async function saveNotification(userId: string, type: string, title: string, body: string, data: Record<string, unknown>): Promise<void> {
  await pool.query(
    `INSERT INTO notifications (user_id, notification_type, title, body, data)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, body, JSON.stringify(data)],
  );
}

interface KafkaEvent {
  loadId?: string;
  merchantId?: string;
  truckerId?: string;
  reason?: string;
  podPhotoUrl?: string;
}

async function handleEvent(topic: string, event: KafkaEvent): Promise<void> {
  const handlers: Record<string, () => Promise<void>> = {
    'load.created': async () => {
      // No push needed — load is visible in discovery feed
      logger.debug('Load created event processed', { loadId: event.loadId });
    },

    'load.accepted': async () => {
      if (!event.merchantId || !event.truckerId || !event.loadId) return;

      const merchantFcm = await getUserFcmToken(event.merchantId);
      if (merchantFcm) {
        await sendFcmNotification({
          token: merchantFcm,
          title: 'Trucker Accepted Your Load',
          body: `A trucker has accepted your load ${event.loadId}. They are on their way to pick it up.`,
          data: { loadId: event.loadId, type: 'load_accepted' },
        });
      }

      await saveNotification(event.merchantId, 'bid_accepted', 'Trucker Accepted Your Load', `Load ${event.loadId} was accepted`, { loadId: event.loadId });
    },

    'load.pickup_started': async () => {
      if (!event.merchantId || !event.loadId) return;
      const fcm = await getUserFcmToken(event.merchantId);
      if (fcm) {
        await sendFcmNotification({ token: fcm, title: 'Goods Picked Up', body: `Your load ${event.loadId} has been picked up and is in transit.`, data: { loadId: event.loadId, type: 'load_picked_up' } });
      }
    },

    'load.delivered': async () => {
      if (!event.merchantId || !event.truckerId || !event.loadId) return;

      const [merchantFcm, truckerFcm, truckerPhone] = await Promise.all([
        getUserFcmToken(event.merchantId),
        getUserFcmToken(event.truckerId),
        getUserPhone(event.truckerId),
      ]);

      if (merchantFcm) {
        await sendFcmNotification({ token: merchantFcm, title: 'Delivery Confirmed', body: `Load ${event.loadId} has been delivered successfully.`, data: { loadId: event.loadId, type: 'load_delivered' } });
      }
      if (truckerFcm) {
        await sendFcmNotification({ token: truckerFcm, title: 'Delivery Confirmed — Payment Pending', body: 'Your delivery is confirmed. Payment will be released within 24 hours.', data: { loadId: event.loadId, type: 'payment_pending' } });
      }
      if (truckerPhone) {
        await sendSms(truckerPhone, `TruckPlatform: Load ${event.loadId} delivered successfully. Payment will be credited within 24 hours.`);
      }

      await saveNotification(event.merchantId, 'load_delivered', 'Delivery Confirmed', `Load ${event.loadId} delivered`, { loadId: event.loadId });
    },

    'load.cancelled': async () => {
      const targets = [event.merchantId, event.truckerId].filter(Boolean) as string[];
      for (const userId of targets) {
        const fcm = await getUserFcmToken(userId);
        if (fcm) {
          await sendFcmNotification({ token: fcm, title: 'Load Cancelled', body: `Load ${event.loadId} has been cancelled. Reason: ${event.reason ?? 'Not specified'}`, data: { loadId: event.loadId ?? '', type: 'load_cancelled' } });
        }
        await saveNotification(userId, 'load_cancelled', 'Load Cancelled', `Load ${event.loadId} cancelled`, { loadId: event.loadId, reason: event.reason });
      }
    },
  };

  const handler = handlers[topic];
  if (handler) {
    await handler();
  } else {
    logger.warn('No handler for topic', { topic });
  }
}

let consumer: Consumer | null = null;

export async function startEventConsumer(): Promise<void> {
  consumer = kafka.consumer({ groupId: 'notification-service-group' });
  await consumer.connect();
  await consumer.subscribe({ topics: TOPICS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }: EachMessagePayload) => {
      if (!message.value) return;
      try {
        const event = JSON.parse(message.value.toString()) as KafkaEvent;
        await handleEvent(topic, event);
      } catch (err) {
        logger.error('Failed to process Kafka message', { topic, error: (err as Error).message });
      }
    },
  });

  logger.info('Kafka consumer started', { topics: TOPICS });
}

export async function stopEventConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}
