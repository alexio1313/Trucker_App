"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const postgres_1 = require("../db/postgres");
const logger_1 = require("../logger");
const router = (0, express_1.Router)();
exports.kycRoutes = router;

router.get('/', async (req, res) => {
    const page = parseInt(req.query['page']) || 1;
    const pageSize = Math.min(parseInt(req.query['pageSize']) || 20, 100);
    const status = req.query['status'] || 'pending';
    const offset = (page - 1) * pageSize;
    const [rows, countRows] = await Promise.all([
        (0, postgres_1.query)(`SELECT user_id, user_type, full_name, phone_number, email,
              kyc_status, kyc_doc_front_url, kyc_doc_back_url, created_at
       FROM users WHERE kyc_status = $1
       ORDER BY created_at ASC LIMIT $2 OFFSET $3`, [status, pageSize, offset]),
        (0, postgres_1.query)('SELECT COUNT(*) FROM users WHERE kyc_status = $1', [status]),
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

router.post('/:userId/approve', async (req, res) => {
    const adminId = req.headers['x-user-id'];
    const user = await (0, postgres_1.queryOne)('SELECT user_id, kyc_status FROM users WHERE user_id = $1', [req.params.userId]);
    if (!user) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        return;
    }
    await (0, postgres_1.query)(`UPDATE users SET kyc_status = 'verified', updated_at = NOW() WHERE user_id = $1`, [req.params.userId]);
    await (0, postgres_1.query)(`INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, after_state, ip_address, user_agent)
     VALUES ($1, 'KYC_APPROVED', 'user', $2, '{}', $3, $4)`, [adminId, req.params.userId, req.ip ?? '', req.headers['user-agent'] ?? '']);
    logger_1.logger.info('KYC approved', { targetUserId: req.params.userId, adminId });
    res.json({ success: true, data: { message: 'KYC approved' } });
});

router.post('/:userId/reject', async (req, res) => {
    const schema = zod_1.z.object({ reason: zod_1.z.string().min(5).max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason required' } });
        return;
    }
    const adminId = req.headers['x-user-id'];
    await (0, postgres_1.query)(`UPDATE users SET kyc_status = 'rejected', updated_at = NOW() WHERE user_id = $1`, [req.params.userId]);
    await (0, postgres_1.query)(`INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, after_state, ip_address, user_agent)
     VALUES ($1, 'KYC_REJECTED', 'user', $2, $3::jsonb, $4, $5)`, [adminId, req.params.userId, JSON.stringify({ reason: parsed.data.reason }), req.ip ?? '', req.headers['user-agent'] ?? '']);
    logger_1.logger.info('KYC rejected', { targetUserId: req.params.userId, adminId });
    res.json({ success: true, data: { message: 'KYC rejected' } });
});
//# sourceMappingURL=kyc.routes.js.map
