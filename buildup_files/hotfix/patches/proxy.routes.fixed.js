"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyRoutes = void 0;
const express_1 = require("express");
const http_proxy_middleware_1 = require("http-proxy-middleware");
const fixRequestBody = http_proxy_middleware_1.fixRequestBody;
const env_1 = require("../config/env");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limit_middleware_1 = require("../middleware/rate-limit.middleware");
const router = (0, express_1.Router)();
exports.proxyRoutes = router;

// makeProxy(target, pathPrefix)
// For router.use('/foo', makeProxy(URL, '/api/v1/foo'))  → proxy receives stripped path, rewrite prepends /api/v1/foo
// For router.get('/auth/me', makeProxy(URL, '/api/v1')) → proxy receives /auth/me, rewrite prepends /api/v1
function makeProxy(target, pathPrefix) {
    return (0, http_proxy_middleware_1.createProxyMiddleware)({
        target,
        changeOrigin: true,
        pathRewrite: pathPrefix
            ? function(path) { return pathPrefix + path; }
            : undefined,
        on: {
            proxyReq: fixRequestBody,
            error: (err, req, res) => {
                if (res && typeof res.status === 'function') {
                    res.status(502).json({
                        success: false,
                        error: { code: 'UPSTREAM_ERROR', message: 'Service temporarily unavailable' },
                    });
                }
            },
        },
    });
}

// =============================================================
// PUBLIC ROUTES (no auth required)
// =============================================================
// Auth endpoints (rate limited) — router.post strips nothing for method routes, proxy sees /auth/register etc.
router.post('/auth/register', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL, '/api/v1'));
router.post('/auth/login', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL, '/api/v1'));
router.post('/auth/send-otp', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL, '/api/v1'));
router.post('/auth/verify-otp', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL, '/api/v1'));
router.post('/auth/refresh', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL, '/api/v1'));
// =============================================================
// PROTECTED ROUTES (JWT required)
// =============================================================
// Auth
router.get('/auth/me', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, '/api/v1'));
router.post('/auth/logout', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, '/api/v1'));
// KYC — router.use strips /kyc prefix, proxy sees / or /:id etc.
router.use('/kyc', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, '/api/v1/kyc'));
// Loads (merchants + truckers)
router.use('/loads', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL, '/api/v1/loads'));
// Pricing
router.use('/pricing', auth_middleware_1.authMiddleware, makeProxy(env_1.env.PRICING_SERVICE_URL, '/api/v1/pricing'));
// Tracking
router.use('/tracking', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, '/api/v1/tracking'));
// Truckers
router.use('/truckers', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, '/api/v1/truckers'));
// Payments
router.use('/payments', auth_middleware_1.authMiddleware, makeProxy(env_1.env.PAYMENT_SERVICE_URL, '/api/v1/payments'));
// Notifications
router.use('/notifications', auth_middleware_1.authMiddleware, makeProxy(env_1.env.NOTIFICATION_SERVICE_URL, '/api/v1/notifications'));
// Ratings
router.use('/ratings', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL, '/api/v1/ratings'));
// Disputes
router.use('/disputes', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL, '/api/v1/disputes'));
// Social (admin + merchant only)
router.use('/social', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)('admin', 'merchant'), makeProxy(env_1.env.SOCIAL_SERVICE_URL, '/api/v1/social'));
// Admin (admin only)
router.use('/admin', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)('admin'), makeProxy(env_1.env.ADMIN_SERVICE_URL, '/api/v1/admin'));
//# sourceMappingURL=proxy.routes.js.map
