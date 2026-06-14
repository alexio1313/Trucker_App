import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db/postgres';
import { logger } from '../logger';

const router = Router();

// KYC queue — pending verifications
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = Math.min(parseInt(req.query['pageSize'] as string) || 20, 100);
  const status = (req.query['status'] as string) || 'pending';
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    query(
      `SELECT user_id, user_type, full_name, phone_number, email,
              kyc_status, kyc_doc_front_key, kyc_doc_back_key, created_at
       FROM users WHERE kyc_status = $1
       ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
      [status, pageSize, offset],
    ),
    query<{ count: string }>('SELECT COUNT(*) FROM users WHERE kyc_status = $1', [status]),
  ]);

  const total = parseInt(countRows[0]?.count ?? '0', 10);
  res.json({
    success: true,
    data: {
      items: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNextPage: page * pageSize < total, hasPrevPage: page > 1 },
    },
  });
});

// Approve KYC
router.post('/:userId/approve', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.headers['x-user-id'] as string;
  const user = await queryOne('SELECT user_id, kyc_status FROM users WHERE user_id = $1', [req.params.userId]);
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  await query(
    `UPDATE users SET kyc_status = 'verified', updated_at = NOW() WHERE user_id = $1`,
    [req.params.userId],
  );

  await query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_value, ip_address, user_agent)
     VALUES ($1, 'KYC_APPROVED', 'user', $2, '{}', $3, $4)`,
    [adminId, req.params.userId, req.ip ?? '', req.headers['user-agent'] ?? ''],
  );

  logger.info('KYC approved', { targetUserId: req.params.userId, adminId });
  res.json({ success: true, data: { message: 'KYC approved' } });
});

// Reject KYC
router.post('/:userId/reject', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({ reason: z.string().min(5).max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason required' } });
    return;
  }

  const adminId = req.headers['x-user-id'] as string;
  await query(
    `UPDATE users SET kyc_status = 'rejected', updated_at = NOW() WHERE user_id = $1`,
    [req.params.userId],
  );

  await query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_value, ip_address, user_agent)
     VALUES ($1, 'KYC_REJECTED', 'user', $2, $3, $4, $5)`,
    [adminId, req.params.userId, JSON.stringify({ reason: parsed.data.reason }), req.ip ?? '', req.headers['user-agent'] ?? ''],
  );

  logger.info('KYC rejected', { targetUserId: req.params.userId, adminId });
  res.json({ success: true, data: { message: 'KYC rejected' } });
});

export { router as kycRoutes };
