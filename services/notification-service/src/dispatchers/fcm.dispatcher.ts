import { env } from '../config/env';
import { logger } from '../logger';

interface FcmPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let messaging: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMessaging(): Promise<any> {
  if (messaging) return messaging;

  if (!env.FCM_PROJECT_ID || !env.FCM_PRIVATE_KEY || !env.FCM_CLIENT_EMAIL) {
    throw new Error('FCM credentials not configured');
  }

  const admin = await import('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FCM_PROJECT_ID,
        privateKey: env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: env.FCM_CLIENT_EMAIL,
      }),
    });
  }

  messaging = admin.messaging();
  return messaging;
}

export async function sendFcmNotification(payload: FcmPayload): Promise<void> {
  try {
    const fcm = await getMessaging();
    await fcm.send({
      token: payload.token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
    logger.debug('FCM sent', { title: payload.title });
  } catch (err) {
    logger.error('FCM send failed', { error: (err as Error).message, title: payload.title });
  }
}
