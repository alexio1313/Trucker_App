"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRoutes = void 0;
const express_1 = require("express");
const postgres_1 = require("../db/postgres");
const router = (0, express_1.Router)();
exports.analyticsRoutes = router;

router.get('/', async (_req, res) => {
    try {
        const [activeLoadsResult, gmv24hResult, successRateResult, activeUsersResult, pendingKycResult, openDisputesResult, revenue24hResult, avgDeliveryResult,] = await Promise.all([
            (0, postgres_1.query)(`SELECT COUNT(*) FROM loads WHERE status IN ('accepted','loading','in_transit')`),
            (0, postgres_1.query)(`SELECT COALESCE(SUM(agreed_price), 0) AS total FROM loads
       WHERE status = 'delivered' AND delivery_confirmed_at >= NOW() - INTERVAL '24 hours'`),
            (0, postgres_1.query)(`SELECT ROUND(
         COUNT(*) FILTER (WHERE status = 'delivered') * 100.0 /
         NULLIF(COUNT(*) FILTER (WHERE status IN ('delivered','cancelled')), 0), 1
       ) AS rate FROM loads WHERE created_at >= NOW() - INTERVAL '30 days'`),
            (0, postgres_1.query)(`SELECT COUNT(DISTINCT user_id) FROM users WHERE last_login_at >= NOW() - INTERVAL '24 hours'`),
            (0, postgres_1.query)(`SELECT COUNT(*) FROM users WHERE kyc_status = 'pending'`),
            (0, postgres_1.query)(`SELECT COUNT(*) FROM disputes WHERE status IN ('open','under_review')`),
            (0, postgres_1.query)(`SELECT COALESCE(SUM(platform_commission), 0) AS total FROM loads
       WHERE status = 'delivered' AND delivery_confirmed_at >= NOW() - INTERVAL '24 hours'`),
            (0, postgres_1.query)(`SELECT ROUND(AVG(EXTRACT(EPOCH FROM (delivery_confirmed_at - created_at))/3600), 1) AS avg_hours
       FROM loads WHERE status = 'delivered' AND delivery_confirmed_at IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'`),
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
                avgDeliveryTime: parseFloat(avgDeliveryResult[0]?.avg_hours ?? '0'),
            },
        });
    } catch (e) {
        console.error('Admin analytics error:', e.message);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

router.get('/loads-over-time', async (req, res) => {
    try {
        const days = Math.min(parseInt(req.query['days']) || 30, 90);
        const rows = await (0, postgres_1.query)(`SELECT DATE(created_at) AS date, COUNT(*) AS count, COALESCE(SUM(agreed_price), 0) AS gmv
     FROM loads WHERE created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at) ORDER BY date ASC`);
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

router.get('/revenue-breakdown', async (_req, res) => {
    try {
        const rows = await (0, postgres_1.query)(`SELECT status, COUNT(*) AS count, COALESCE(SUM(platform_commission), 0) AS total_commission
     FROM loads GROUP BY status ORDER BY total_commission DESC`);
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

router.get('/top-routes', async (_req, res) => {
    try {
        const rows = await (0, postgres_1.query)(`SELECT CONCAT(origin_city, ' → ', dest_city) AS route,
            COUNT(*) AS count,
            ROUND(AVG(agreed_price)) AS avg_price
     FROM loads WHERE status = 'delivered'
     GROUP BY origin_city, dest_city
     ORDER BY count DESC LIMIT 10`);
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});
//# sourceMappingURL=analytics.routes.js.map
