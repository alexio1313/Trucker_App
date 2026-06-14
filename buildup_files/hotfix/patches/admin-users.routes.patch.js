"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const postgres_1 = require("../db/postgres");
const logger_1 = require("../logger");
const router = (0, express_1.Router)();
exports.usersRoutes = router;

router.get('/', async (req, res) => {
    try {
        const schema = zod_1.z.object({
            page: zod_1.z.coerce.number().int().min(1).default(1),
            pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
            userType: zod_1.z.enum(['merchant', 'trucker', 'admin']).optional(),
            kycStatus: zod_1.z.enum(['pending', 'verified', 'rejected']).optional(),
            isSuspended: zod_1.z.coerce.boolean().optional(),
            search: zod_1.z.string().optional(),
        });
        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query params' } });
            return;
        }
        const { page, pageSize, userType, kycStatus, isSuspended, search } = parsed.data;
        const offset = (page - 1) * pageSize;
        const conditions = [];
        const params = [];
        let idx = 1;
        if (userType) { conditions.push(`user_type = $${idx++}`); params.push(userType); }
        if (kycStatus) { conditions.push(`kyc_status = $${idx++}`); params.push(kycStatus); }
        if (isSuspended !== undefined) { conditions.push(`is_suspended = $${idx++}`); params.push(isSuspended); }
        if (search) {
            conditions.push(`(full_name ILIKE $${idx} OR phone_number ILIKE $${idx} OR email ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(pageSize, offset);
        const [rows, countRows] = await Promise.all([
            (0, postgres_1.query)(`SELECT user_id, user_type, full_name, phone_number, email, kyc_status, rating, total_ratings, is_suspended, suspended_until, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, params),
            (0, postgres_1.query)(`SELECT COUNT(*) FROM users ${where}`, params.slice(0, -2)),
        ]);
        const total = parseInt(countRows[0]?.count ?? '0', 10);
        res.json({ success: true, data: { items: rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNextPage: page * pageSize < total, hasPrevPage: page > 1 } } });
    } catch (e) {
        console.error('admin/users GET error:', e.message);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

router.get('/:userId', async (req, res) => {
    try {
        const user = await (0, postgres_1.queryOne)('SELECT * FROM users WHERE user_id = $1', [req.params.userId]);
        if (!user) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }); return; }
        const u = { ...user };
        delete u['password_hash'];
        res.json({ success: true, data: u });
    } catch (e) {
        console.error('admin/users/:id GET error:', e.message);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

router.post('/:userId/suspend', async (req, res) => {
    try {
        const schema = zod_1.z.object({ reason: zod_1.z.string().min(5).max(500), until: zod_1.z.string().datetime().optional() });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason required' } }); return; }
        const adminId = req.headers['x-user-id'];
        await (0, postgres_1.query)(`UPDATE users SET is_suspended = true, suspension_reason = $2, suspended_until = $3, updated_at = NOW() WHERE user_id = $1`, [req.params.userId, parsed.data.reason, parsed.data.until ?? null]);
        await (0, postgres_1.query)(
            `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, after_state, ip_address, user_agent) VALUES ($1, 'SUSPEND_USER', 'user', $2, $3::jsonb, $4, $5)`,
            [adminId, req.params.userId, JSON.stringify({ reason: parsed.data.reason }), req.ip ?? '', req.headers['user-agent'] ?? '']
        );
        logger_1.logger.info('User suspended', { targetUserId: req.params.userId, adminId, reason: parsed.data.reason });
        res.json({ success: true, data: { message: 'User suspended' } });
    } catch (e) {
        console.error('admin/users/:id/suspend error:', e.message);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

router.post('/:userId/unsuspend', async (req, res) => {
    try {
        const adminId = req.headers['x-user-id'];
        await (0, postgres_1.query)(`UPDATE users SET is_suspended = false, suspension_reason = NULL, suspended_until = NULL, updated_at = NOW() WHERE user_id = $1`, [req.params.userId]);
        await (0, postgres_1.query)(
            `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, after_state, ip_address, user_agent) VALUES ($1, 'UNSUSPEND_USER', 'user', $2, '{}', $3, $4)`,
            [adminId, req.params.userId, req.ip ?? '', req.headers['user-agent'] ?? '']
        );
        logger_1.logger.info('User unsuspended', { targetUserId: req.params.userId, adminId });
        res.json({ success: true, data: { message: 'User unsuspended' } });
    } catch (e) {
        console.error('admin/users/:id/unsuspend error:', e.message);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});
//# sourceMappingURL=users.routes.js.map
