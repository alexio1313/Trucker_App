import { Pool } from 'pg';
import { createClient } from 'redis';
import { env } from '../config/env';
import { logger } from '../logger';
import { aiGenerate } from '../ai/ollama.client';

const pool = new Pool({ connectionString: env.DATABASE_URL });
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis(): Promise<ReturnType<typeof createClient>> {
  if (!redisClient) {
    redisClient = createClient({ url: env.REDIS_URL });
    await redisClient.connect();
  }
  return redisClient;
}

interface MatchScore {
  truckerId: string;
  truckId: string;
  score: number;         // 0–100
  reason: string;
  estimatedProfit: number;
  distanceToPickup: number;
  truckerRating: number;
}

export async function computeLoadMatchScores(loadId: string): Promise<MatchScore[]> {
  const cacheKey = `match:${loadId}`;
  const redis = await getRedis();
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as MatchScore[];

  // Get load details
  const loadResult = await pool.query(
    `SELECT l.*, ST_X(origin_location::geometry) AS origin_lng,
            ST_Y(origin_location::geometry) AS origin_lat
     FROM loads l WHERE l.load_id = $1`,
    [loadId],
  );
  const load = loadResult.rows[0];
  if (!load) return [];

  // Get available truckers with appropriate truck capacity
  const truckersResult = await pool.query(
    `SELECT u.user_id, u.full_name, u.rating, u.total_ratings,
            t.truck_id, t.truck_type, t.capacity_kg, t.fuel_type, t.mileage_kmpl,
            t.current_lat, t.current_lng
     FROM users u
     JOIN trucks t ON t.trucker_id = u.user_id AND t.status = 'available'
     WHERE u.user_type = 'trucker'
       AND u.availability_status = 'available'
       AND u.is_suspended = false
       AND u.kyc_status = 'verified'
       AND t.capacity_kg >= $1`,
    [load.cargo_weight_kg],
  );

  const truckers = truckersResult.rows;
  if (truckers.length === 0) return [];

  // Build AI scoring prompt with top-15 candidate data
  const candidates = truckers.slice(0, 15);
  const prompt = `You are a logistics AI scoring truckers for a freight load.

Load details:
- Origin: ${load.origin_city}, ${load.origin_state}
- Destination: ${load.dest_city}, ${load.dest_state}
- Cargo: ${load.cargo_weight_kg}kg, type=${load.cargo_type}
- Pickup: ${load.pickup_start}
- Price: ₹${load.ai_suggested_price ?? 'TBD'}

Candidates (id, rating, truck_type, capacity_kg, dist_to_pickup_km):
${candidates.map((t, i) => {
  const dist = t.current_lat && t.current_lng
    ? Math.round(Math.sqrt((t.current_lat - load.origin_lat) ** 2 + (t.current_lng - load.origin_lng) ** 2) * 111)
    : 50;
  return `${i + 1}. id=${t.user_id} rating=${t.rating} truck=${t.truck_type} cap=${t.capacity_kg}kg dist=${dist}km`;
}).join('\n')}

Return a JSON array of objects with: truckerId, score (0-100), reason (one sentence).
Score higher for: closer distance, higher rating, better fuel efficiency, cargo type match.
Return ONLY valid JSON, no explanation.`;

  let aiScores: Array<{ truckerId: string; score: number; reason: string }> = [];
  try {
    const aiResponse = await aiGenerate(prompt);
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      aiScores = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    logger.warn('AI scoring failed, using heuristic', { error: (err as Error).message });
  }

  // Build final scores merging AI + heuristics
  const scores: MatchScore[] = candidates.map((t) => {
    const aiScore = aiScores.find((s) => s.truckerId === t.user_id);
    const distToPickup = t.current_lat && t.current_lng
      ? Math.round(Math.sqrt((t.current_lat - load.origin_lat) ** 2 + (t.current_lng - load.origin_lng) ** 2) * 111)
      : 50;

    // Heuristic fallback score
    const heuristicScore = Math.min(
      100,
      (t.rating / 5) * 40 + Math.max(0, 30 - distToPickup * 0.5) + 20,
    );

    return {
      truckerId: t.user_id,
      truckId: t.truck_id,
      score: aiScore?.score ?? heuristicScore,
      reason: aiScore?.reason ?? `Rating ${t.rating}/5, ${distToPickup}km from pickup`,
      estimatedProfit: load.ai_suggested_price
        ? Math.round(load.ai_suggested_price * 0.95 - distToPickup * 5)
        : 0,
      distanceToPickup: distToPickup,
      truckerRating: parseFloat(t.rating),
    };
  });

  scores.sort((a, b) => b.score - a.score);
  await redis.set(cacheKey, JSON.stringify(scores.slice(0, 10)), { EX: 300 });
  logger.debug('Match scores computed', { loadId, candidateCount: scores.length });

  return scores.slice(0, 10);
}
