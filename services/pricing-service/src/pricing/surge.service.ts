import { createClient } from 'redis';
import { Pool } from 'pg';
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

export interface SurgeFactor {
  multiplier: number;
  reasons: string[];
}

export async function calculateSurgeMultiplier(
  originCity: string,
  destinationCity: string,
  cargoType: string,
): Promise<SurgeFactor> {
  const redis = await getRedis();
  const cacheKey = `surge:${originCity}:${destinationCity}:${cargoType}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as SurgeFactor;

  let multiplier = 1.0;
  const reasons: string[] = [];

  // Count available truckers near origin
  const truckersResult = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM users
     WHERE user_type = 'trucker'
     AND is_suspended = false`,
  );
  const availableTruckers = parseInt(truckersResult.rows[0]?.cnt ?? '0', 10);

  // Count active loads competing for truckers
  const loadsResult = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM loads WHERE status = 'posted'`,
  );
  const openLoads = parseInt(loadsResult.rows[0]?.cnt ?? '0', 10);

  const demandRatio = availableTruckers > 0 ? openLoads / availableTruckers : 2;

  if (demandRatio > 3) {
    multiplier = Math.min(multiplier + 0.4, env.MAX_SURGE_MULTIPLIER);
    reasons.push('Very high demand, low trucker availability');
  } else if (demandRatio > 2) {
    multiplier = Math.min(multiplier + 0.2, env.MAX_SURGE_MULTIPLIER);
    reasons.push('High demand relative to available truckers');
  } else if (demandRatio > 1.5) {
    multiplier = Math.min(multiplier + 0.1, env.MAX_SURGE_MULTIPLIER);
    reasons.push('Moderate demand increase');
  }

  // Hazmat premium
  if (['hazmat', 'temperature_controlled'].includes(cargoType)) {
    multiplier = Math.min(multiplier + 0.1, env.MAX_SURGE_MULTIPLIER);
    reasons.push('Specialized cargo handling required');
  }

  multiplier = Math.min(Math.max(multiplier, 1.0), env.MAX_SURGE_MULTIPLIER);
  const factor: SurgeFactor = { multiplier, reasons };

  await redis.set(cacheKey, JSON.stringify(factor), { EX: 300 });
  logger.debug('Surge calculated', { originCity, multiplier, reasons });
  return factor;
}
