import axios from 'axios';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { env } from '../config/env';
import { logger } from '../logger';

const pool = new Pool({ connectionString: env.DATABASE_URL });
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis(): Promise<ReturnType<typeof createClient>> {
  if (!redisClient) {
    redisClient = createClient({ url: env.REDIS_URL });
    await redisClient.connect();
  }
  return redisClient;
}

interface ETAResult {
  estimatedArrival: Date;
  confidenceScore: number;
  delayMinutes: number;
  factors: Array<{ type: string; impactMinutes: number; description: string }>;
}

async function getTrafficFactor(lat: number, lng: number): Promise<number> {
  try {
    const response = await axios.get<{ rows: Array<{ elements: Array<{ duration_in_traffic: { value: number }; duration: { value: number } }> }> }>(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
      {
        params: {
          origins: `${lat},${lng}`,
          destinations: `${lat + 0.01},${lng + 0.01}`,
          departure_time: 'now',
          key: env.GOOGLE_MAPS_API_KEY,
        },
        timeout: 5000,
      },
    );
    const element = response.data.rows[0]?.elements[0];
    if (!element) return 1.0;
    const trafficDuration = element.duration_in_traffic?.value ?? element.duration?.value ?? 1;
    const normalDuration = element.duration?.value ?? 1;
    return Math.min(trafficDuration / normalDuration, 2.0);
  } catch {
    return 1.0;
  }
}

export async function predictETA(loadId: string): Promise<ETAResult> {
  const redis = await getRedis();
  const cacheKey = `eta:${loadId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as ETAResult;

  const loadResult = await pool.query(
    `SELECT l.delivery_expected, l.dest_lat, l.dest_lng,
            lt.latitude AS current_lat, lt.longitude AS current_lng,
            lt.speed_kmh, lt.created_at AS last_update
     FROM loads l
     LEFT JOIN LATERAL (
       SELECT latitude, longitude, speed_kmh, created_at
       FROM load_tracking WHERE load_id = l.load_id
       ORDER BY created_at DESC LIMIT 1
     ) lt ON true
     WHERE l.load_id = $1`,
    [loadId],
  );

  const load = loadResult.rows[0];
  if (!load || !load.current_lat) {
    return {
      estimatedArrival: new Date(load?.delivery_expected ?? Date.now()),
      confidenceScore: 0.3,
      delayMinutes: 0,
      factors: [],
    };
  }

  const distKm = Math.sqrt(
    (load.current_lat - load.dest_lat) ** 2 + (load.current_lng - load.dest_lng) ** 2,
  ) * 111;

  const avgSpeedKmh = load.speed_kmh > 0 ? load.speed_kmh : 45;
  const trafficFactor = await getTrafficFactor(load.current_lat, load.current_lng);
  const adjustedSpeedKmh = avgSpeedKmh / trafficFactor;
  const etaMinutes = Math.round((distKm / adjustedSpeedKmh) * 60);

  const estimatedArrival = new Date(Date.now() + etaMinutes * 60 * 1000);
  const expectedDelivery = new Date(load.delivery_expected);
  const delayMinutes = Math.max(0, Math.round((estimatedArrival.getTime() - expectedDelivery.getTime()) / 60000));

  const factors: Array<{ type: string; impactMinutes: number; description: string }> = [];
  if (trafficFactor > 1.2) {
    factors.push({ type: 'traffic', impactMinutes: Math.round((trafficFactor - 1) * etaMinutes), description: 'Heavy traffic on current route' });
  }
  if (delayMinutes > 30) {
    factors.push({ type: 'route_deviation', impactMinutes: delayMinutes, description: 'Vehicle is behind schedule' });
  }

  const result: ETAResult = {
    estimatedArrival,
    confidenceScore: Math.max(0.4, 1 - (distKm / 500)),
    delayMinutes,
    factors,
  };

  await redis.set(cacheKey, JSON.stringify(result), { EX: 120 });
  logger.debug('ETA predicted', { loadId, distKm: Math.round(distKm), etaMinutes, delayMinutes });

  return result;
}
