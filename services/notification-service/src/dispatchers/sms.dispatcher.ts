import { env } from '../config/env';
import { logger } from '../logger';

export async function sendSms(to: string, message: string): Promise<void> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    logger.warn('Twilio not configured — SMS not sent', { to });
    return;
  }
  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    await client.messages.create({ body: message, from: env.TWILIO_PHONE_NUMBER, to });
    logger.debug('SMS sent', { to });
  } catch (err) {
    logger.error('SMS send failed', { error: (err as Error).message, to });
  }
}
