import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from 'redis';
import { query, queryOne } from '../db/postgres';
import { env } from '../config/env';

const router = Router();
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis(): Promise<ReturnType<typeof createClient>> {
  if (!redisClient) {
    redisClient = createClient({ url: env.REDIS_URL });
    await redisClient.connect();
  }
  return redisClient;
}

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query(
    'SELECT * FROM feature_flags ORDER BY flag_name ASC',
  );
  res.json({ success: true, data: rows });
});

router.patch('/:flagName', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    isEnabled: z.boolean().optional(),
    rolloutPercent: z.number().int().min(0).max(100).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid flag update' } });
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (parsed.data.isEnabled !== undefined) {
    updates.push(`is_enabled = $${idx++}`);
    params.push(parsed.data.isEnabled);
  }
  if (parsed.data.rolloutPercent !== undefined) {
    updates.push(`rollout_percent = $${idx++}`);
    params.push(parsed.data.rolloutPercent);
  }
  if (updates.length === 0) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No updates provided' } });
    return;
  }

  updates.push(`updated_at = NOW()`);
  params.push(req.params.flagName);

  const updated = await queryOne(
    `UPDATE feature_flags SET ${updates.join(', ')} WHERE flag_name = $${idx} RETURNING *`,
    params,
  );

  if (!updated) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Feature flag not found' } });
    return;
  }

  // Sync to Redis cache
  const redis = await getRedis();
  await redis.set(`feature_flag:${req.params.flagName}`, JSON.stringify(updated), { EX: 300 });

  res.json({ success: true, data: updated });
});

export { router as featureFlagsRoutes };
