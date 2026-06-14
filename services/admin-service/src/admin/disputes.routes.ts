import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db/postgres';
import { logger } from '../logger';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = Math.min(parseInt(req.query['pageSize'] as string) || 20, 100);
  const status = req.query['status'] as string | undefined;
  const offset = (page - 1) * pageSize;

  const where = status ? `WHERE d.status = $1` : '';
  const params: unknown[] = status ? [status, pageSize, offset] : [pageSize, offset];
  const limitIdx = status ? 2 : 1;

  const rows = await query(
    `SELECT d.*, l.origin_city, l.dest_city FROM disputes d
     LEFT JOIN loads l ON d.load_id = l.load_id
     ${where} ORDER BY d.created_at DESC LIMIT $${limitIdx} OFFSET $${limitIdx + 1}`,
    params,
  );

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM disputes ${where}`,
    status ? [status] : [],
  );

  const total = parseInt(countRow?.count ?? '0', 10);
  res.json({
    success: true,
    data: {
      items: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNextPage: page * pageSize < total, hasPrevPage: page > 1 },
    },
  });
});

router.post('/:disputeId/resolve', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    resolution: z.string().min(10).max(1000),
    compensationAmount: z.number().min(0).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Resolution text required' } });
    return;
  }

  const adminId = req.headers['x-user-id'] as string;
  const updated = await queryOne(
    `UPDATE disputes SET status = 'resolved', resolved_by = $2,
     resolution = $3, compensation_amount = $4, resolved_at = NOW(), updated_at = NOW()
     WHERE dispute_id = $1 AND status IN ('open','under_review') RETURNING *`,
    [req.params.disputeId, adminId, parsed.data.resolution, parsed.data.compensationAmount ?? null],
  );

  if (!updated) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dispute not found or already resolved' } });
    return;
  }

  logger.info('Dispute resolved', { disputeId: req.params.disputeId, adminId });
  res.json({ success: true, data: updated });
});

export { router as disputesRoutes };
