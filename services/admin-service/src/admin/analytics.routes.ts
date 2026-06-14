import { Router, Request, Response } from 'express';
import { query } from '../db/postgres';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const [
    activeLoadsResult,
    gmv24hResult,
    successRateResult,
    activeUsersResult,
    pendingKycResult,
    openDisputesResult,
    revenue24hResult,
  ] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) FROM loads WHERE status IN ('accepted','loading','in_transit')`,
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(agreed_price), 0) AS total FROM loads
       WHERE status = 'delivered' AND delivery_confirmed_at >= NOW() - INTERVAL '24 hours'`,
    ),
    query<{ rate: string }>(
      `SELECT ROUND(
         COUNT(*) FILTER (WHERE status = 'delivered') * 100.0 /
         NULLIF(COUNT(*) FILTER (WHERE status IN ('delivered','cancelled')), 0), 1
       ) AS rate FROM loads WHERE created_at >= NOW() - INTERVAL '30 days'`,
    ),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT user_id) FROM users WHERE last_login_at >= NOW() - INTERVAL '24 hours'`,
    ),
    query<{ count: string }>(`SELECT COUNT(*) FROM users WHERE kyc_status = 'pending'`),
    query<{ count: string }>(`SELECT COUNT(*) FROM disputes WHERE status IN ('open','under_review')`),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(platform_commission), 0) AS total FROM payments
       WHERE status IN ('captured','settled') AND created_at >= NOW() - INTERVAL '24 hours'`,
    ),
  ]);

  res.json({
    success: true,
    data: {
      activeLoads: parseInt(activeLoadsResult[0]?.count ?? '0', 10),
      gmv24h: parseFloat(gmv24hResult[0]?.total ?? '0'),
      deliverySuccessRate: parseFloat(successRateResult[0]?.rate ?? '0'),
      activeUsers: parseInt(activeUsersResult[0]?.count ?? '0', 10),
      pendingKyc: parseInt(pendingKycResult[0]?.count ?? '0', 10),
      openDisputes: parseInt(openDisputesResult[0]?.count ?? '0', 10),
      revenueToday: parseFloat(revenue24hResult[0]?.total ?? '0'),
    },
  });
});

router.get('/loads-over-time', async (req: Request, res: Response): Promise<void> => {
  const days = Math.min(parseInt(req.query['days'] as string) || 30, 90);
  const rows = await query<{ date: string; count: string; gmv: string }>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count, COALESCE(SUM(agreed_price), 0) AS gmv
     FROM loads WHERE created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at) ORDER BY date ASC`,
  );
  res.json({ success: true, data: rows });
});

router.get('/revenue-breakdown', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query<{ status: string; count: string; total_commission: string }>(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(platform_commission), 0) AS total_commission
     FROM payments GROUP BY status ORDER BY total_commission DESC`,
  );
  res.json({ success: true, data: rows });
});

router.get('/top-routes', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query<{ route: string; count: string; avg_price: string }>(
    `SELECT CONCAT(origin_city, ' → ', dest_city) AS route,
            COUNT(*) AS count,
            ROUND(AVG(agreed_price)) AS avg_price
     FROM loads WHERE status = 'delivered'
     GROUP BY origin_city, dest_city
     ORDER BY count DESC LIMIT 10`,
  );
  res.json({ success: true, data: rows });
});

export { router as analyticsRoutes };
