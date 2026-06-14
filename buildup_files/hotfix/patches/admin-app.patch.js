"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const prom_client_1 = require("prom-client");
const users_routes_1 = require("./admin/users.routes");
const kyc_routes_1 = require("./admin/kyc.routes");
const analytics_routes_1 = require("./admin/analytics.routes");
const disputes_routes_1 = require("./admin/disputes.routes");
const feature_flags_routes_1 = require("./admin/feature-flags.routes");
const logger_1 = require("./logger");
const env_1 = require("./config/env");
const postgres_1 = require("./db/postgres");
const app = (0, express_1.default)();
exports.app = app;
const register = new prom_client_1.Registry();
(0, prom_client_1.collectDefaultMetrics)({ register });
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '5mb' }));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'admin-service', timestamp: new Date().toISOString() });
});
app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});
// Audit logs — actual columns: admin_id, action, entity_type, entity_id, before_state, after_state
app.get('/api/v1/admin/audit-logs', async (req, res) => {
    try {
        const page = parseInt(req.query['page']) || 1;
        const pageSize = Math.min(parseInt(req.query['pageSize']) || 20, 100);
        const adminId = req.query['userId'] || req.query['adminId'];
        const offset = (page - 1) * pageSize;
        const conditions = [];
        const params = [];
        if (adminId) {
            params.push(adminId);
            conditions.push(`al.admin_id = $${params.length}`);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(pageSize, offset);
        const rows = await postgres_1.pool.query(
            `SELECT al.*, u.full_name as admin_name FROM audit_logs al
             LEFT JOIN users u ON u.user_id = al.admin_id
             ${where} ORDER BY al.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        const countRows = await postgres_1.pool.query(
            `SELECT COUNT(*) FROM audit_logs al ${where}`,
            params.slice(0, -2)
        );
        const total = parseInt(countRows.rows[0]?.count ?? '0', 10);
        res.json({
            success: true,
            data: {
                items: rows.rows,
                pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
            },
        });
    } catch (e) {
        console.error('audit-logs error:', e.message);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});
app.use('/api/v1/admin/users', users_routes_1.usersRoutes);
app.use('/api/v1/admin/kyc', kyc_routes_1.kycRoutes);
app.use('/api/v1/admin/analytics', analytics_routes_1.analyticsRoutes);
app.use('/api/v1/admin/disputes', disputes_routes_1.disputesRoutes);
app.use('/api/v1/admin/feature-flags', feature_flags_routes_1.featureFlagsRoutes);
app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});
app.use((err, _req, res, _next) => {
    logger_1.logger.error('Unhandled error', { error: err.message });
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});
const server = app.listen(env_1.env.PORT, () => {
    logger_1.logger.info(`Admin Service listening on port ${env_1.env.PORT}`);
});
process.on('SIGTERM', async () => {
    server.close(async () => {
        await postgres_1.pool.end();
        process.exit(0);
    });
});
process.on('unhandledRejection', (reason) => {
    logger_1.logger.error('Unhandled promise rejection', { reason });
    process.exit(1);
});
//# sourceMappingURL=app.js.map
