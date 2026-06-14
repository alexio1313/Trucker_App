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
function makeProxy(target) {
    return (0, http_proxy_middleware_1.createProxyMiddleware)({
        target,
        changeOrigin: true,
        on: {
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
// Auth endpoints (rate limited)
router.post('/auth/register', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/login', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/send-otp', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/verify-otp', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/refresh', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
// =============================================================
// PROTECTED ROUTES (JWT required)
// =============================================================
// Auth
router.get('/auth/me', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/logout', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
// KYC
router.use('/kyc', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
// Loads (merchants + truckers)
router.use('/loads', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL));
// Pricing
router.use('/pricing', auth_middleware_1.authMiddleware, makeProxy(env_1.env.PRICING_SERVICE_URL));
// Tracking
router.use('/tracking', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
// Truckers
router.use('/truckers', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
// Payments
router.use('/payments', auth_middleware_1.authMiddleware, makeProxy(env_1.env.PAYMENT_SERVICE_URL));
// Notifications
router.use('/notifications', auth_middleware_1.authMiddleware, makeProxy(env_1.env.NOTIFICATION_SERVICE_URL));
// Ratings
router.use('/ratings', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL));
// Disputes
router.use('/disputes', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL));
// Social (admin + merchant only)
router.use('/social', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)('admin', 'merchant'), makeProxy(env_1.env.SOCIAL_SERVICE_URL));
// Admin (admin only)
router.use('/admin', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)('admin'), makeProxy(env_1.env.ADMIN_SERVICE_URL));
//# sourceMappingURL=proxy.routes.js.map
