import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { query, queryOne } from '../db/postgres';
import { env } from '../config/env';
import { logger } from '../logger';

const router = Router();

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
});

async function generateSignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: env.KYC_URL_EXPIRY_SECONDS });
}

// List users with filters
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    userType: z.enum(['merchant', 'trucker', 'admin']).optional(),
    kycStatus: z.enum(['pending', 'verified', 'rejected']).optional(),
    isSuspended: z.coerce.boolean().optional(),
    search: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query params' } });
    return;
  }

  const { page, pageSize, userType, kycStatus, isSuspended, search } = parsed.data;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (userType) { conditions.push(`user_type = $${idx++}`); params.push(userType); }
  if (kycStatus) { conditions.push(`kyc_status = $${idx++}`); params.push(kycStatus); }
  if (isSuspended !== undefined) { conditions.push(`is_suspended = $${idx++}`); params.push(isSuspended); }
  if (search) {
    conditions.push(`(full_name ILIKE $${idx} OR phone_number ILIKE $${idx} OR email ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(pageSize, offset);

  const [rows, countRows] = await Promise.all([
    query(`SELECT user_id, user_type, full_name, phone_number, email, kyc_status, rating, total_ratings, is_suspended, suspended_until, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, params),
    query<{ count: string }>(`SELECT COUNT(*) FROM users ${where}`, params.slice(0, -2)),
  ]);

  const total = parseInt(countRows[0]?.count ?? '0', 10);
  res.json({ success: true, data: { items: rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNextPage: page * pageSize < total, hasPrevPage: page > 1 } } });
});

// Get single user with KYC signed URLs
router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  const user = await queryOne('SELECT * FROM users WHERE user_id = $1', [req.params.userId]);
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const u = user as Record<string, unknown>;
  // Generate signed URLs for KYC docs if present
  if (u['kyc_doc_front_key']) {
    u['kyc_doc_front_url'] = await generateSignedUrl(u['kyc_doc_front_key'] as string);
  }
  if (u['kyc_doc_back_key']) {
    u['kyc_doc_back_url'] = await generateSignedUrl(u['kyc_doc_back_key'] as string);
  }
  delete u['password_hash'];

  res.json({ success: true, data: u });
});

// Suspend user
router.post('/:userId/suspend', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    reason: z.string().min(5).max(500),
    until: z.string().datetime().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason required' } });
    return;
  }

  const adminId = req.headers['x-user-id'] as string;
  await query(
    `UPDATE users SET is_suspended = true, suspension_reason = $2,
     suspended_until = $3, updated_at = NOW() WHERE user_id = $1`,
    [req.params.userId, parsed.data.reason, parsed.data.until ?? null],
  );
  await query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_value, ip_address, user_agent)
     VALUES ($1, 'SUSPEND_USER', 'user', $2, $3, $4, $5)`,
    [adminId, req.params.userId, JSON.stringify({ reason: parsed.data.reason }), req.ip ?? '', req.headers['user-agent'] ?? ''],
  );

  logger.info('User suspended', { targetUserId: req.params.userId, adminId, reason: parsed.data.reason });
  res.json({ success: true, data: { message: 'User suspended' } });
});

// Unsuspend user
router.post('/:userId/unsuspend', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.headers['x-user-id'] as string;
  await query(
    `UPDATE users SET is_suspended = false, suspension_reason = NULL,
     suspended_until = NULL, updated_at = NOW() WHERE user_id = $1`,
    [req.params.userId],
  );
  await query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_value, ip_address, user_agent)
     VALUES ($1, 'UNSUSPEND_USER', 'user', $2, '{}', $3, $4)`,
    [adminId, req.params.userId, req.ip ?? '', req.headers['user-agent'] ?? ''],
  );

  logger.info('User unsuspended', { targetUserId: req.params.userId, adminId });
  res.json({ success: true, data: { message: 'User unsuspended' } });
});

export { router as usersRoutes };
