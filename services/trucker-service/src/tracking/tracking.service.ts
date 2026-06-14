import { createClient } from 'redis';
import { query } from '../db/postgres';
import { env } from '../config/env';
import { logger } from '../logger';

interface LocationUpdate {
  loadId: string;
  truckId: string;
  truckerId: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
  accuracy?: number;
  batteryLevel?: number;
}

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis(): Promise<ReturnType<typeof createClient>> {
  if (!redisClient) {
    redisClient = createClient({ url: env.REDIS_URL });
    await redisClient.connect();
  }
  return redisClient;
}

export async function recordLocationUpdate(update: LocationUpdate): Promise<void> {
  await query(
    `INSERT INTO load_tracking
     (load_id, truck_id, trucker_id, latitude, longitude, speed_kmh, heading, accuracy, battery_level, event_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'gps_update')`,
    [
      update.loadId,
      update.truckId,
      update.truckerId,
      update.lat,
      update.lng,
      update.speedKmh ?? null,
      update.heading ?? null,
      update.accuracy ?? null,
      update.batteryLevel ?? null,
    ],
  );

  const redis = await getRedis();
  const locationKey = `tracking:live:${update.loadId}`;
  await redis.setEx(
    locationKey,
    300,
    JSON.stringify({
      lat: update.lat,
      lng: update.lng,
      speedKmh: update.speedKmh ?? 0,
      heading: update.heading ?? 0,
      updatedAt: new Date().toISOString(),
    }),
  );

  await redis.set(`truck:location:${update.truckId}`, JSON.stringify({ lat: update.lat, lng: update.lng, loadId: update.loadId }), { EX: 600 });

  logger.debug('Location recorded', { loadId: update.loadId, truckerId: update.truckerId });
}

export async function getLiveTracking(loadId: string): Promise<Record<string, unknown> | null> {
  const redis = await getRedis();
  const raw = await redis.get(`tracking:live:${loadId}`);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

export async function setTruckerAvailability(
  truckerId: string,
  status: 'available' | 'offline',
): Promise<void> {
  await query(
    'UPDATE users SET availability_status = $2, updated_at = NOW() WHERE user_id = $1',
    [truckerId, status],
  );

  const redis = await getRedis();
  if (status === 'offline') {
    await redis.del(`trucker:available:${truckerId}`);
  } else {
    await redis.set(`trucker:available:${truckerId}`, '1', { EX: 1800 });
  }
}
