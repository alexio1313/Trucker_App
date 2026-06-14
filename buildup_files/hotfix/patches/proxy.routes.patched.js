"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyRoutes = void 0;
const express_1 = require("express");
const http_proxy_middleware_1 = require("http-proxy-middleware");
const env_1 = require("../config/env");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limit_middleware_1 = require("../middleware/rate-limit.middleware");
const router = (0, express_1.Router)();
exports.proxyRoutes = router;
// Express strips path prefixes (/api/v1 by app.use, then /social etc by router.use).
// Restore the full original URL via req.originalUrl so the upstream gets the right path.
// Also re-inject the body that express.json() consumed before the proxy can forward it.
function fixRequest(proxyReq, req) {
    // Restore full path from originalUrl (e.g. /api/v1/social/posts?page=1)
    proxyReq.path = req.originalUrl;
    // Re-inject parsed body
    if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
        proxyReq.end();
    }
}
function makeProxy(target) {
    return (0, http_proxy_middleware_1.createProxyMiddleware)({
        target,
        changeOrigin: true,
        on: {
            proxyReq: fixRequest,
            error: (err, req, res) => {
                res.status(502).json({
                    success: false,
                    error: { code: 'UPSTREAM_ERROR', message: 'Service temporarily unavailable' },
                });
            },
        },
    });
}
// =============================================================
// PUBLIC ROUTES (no auth required)
// =============================================================
router.post('/auth/register', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/login', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/send-otp', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/verify-otp', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/refresh', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
// =============================================================
// PROTECTED ROUTES (JWT required)
// =============================================================
router.get('/auth/me', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/logout', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.use('/kyc', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.use('/loads', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL));
router.use('/pricing', auth_middleware_1.authMiddleware, makeProxy(env_1.env.PRICING_SERVICE_URL));
router.use('/tracking', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.use('/truckers', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.use('/payments', auth_middleware_1.authMiddleware, makeProxy(env_1.env.PAYMENT_SERVICE_URL));
router.use('/notifications', auth_middleware_1.authMiddleware, makeProxy(env_1.env.NOTIFICATION_SERVICE_URL));
router.use('/ratings', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL));
router.use('/disputes', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL));
router.use('/social', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)('admin', 'merchant'), makeProxy(env_1.env.SOCIAL_SERVICE_URL));
router.use('/admin', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)('admin'), makeProxy(env_1.env.ADMIN_SERVICE_URL));
//# sourceMappingURL=proxy.routes.js.map
