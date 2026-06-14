import { Router } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { env } from '../config/env';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { authRateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// pathPrefix: for router.use routes, prepend '/api/v1/<resource>'; for method routes, prepend '/api/v1'
// This is needed because Express strips matched path segments before calling proxy middleware.
function makeProxy(target: string, pathPrefix: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path: string) => pathPrefix + path,
    on: {
      proxyReq: fixRequestBody,
      error: (err, req, res) => {
        if (res && typeof (res as import('express').Response).status === 'function') {
          (res as import('express').Response).status(502).json({
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

// Auth endpoints — router.post preserves path, proxy sees /auth/login etc.
router.post('/auth/register', authRateLimit, makeProxy(env.TRUCKER_SERVICE_URL, '/api/v1'));
router.post('/auth/login', authRateLimit, makeProxy(env.TRUCKER_SERVICE_URL, '/api/v1'));
router.post('/auth/send-otp', authRateLimit, makeProxy(env.TRUCKER_SERVICE_URL, '/api/v1'));
router.post('/auth/verify-otp', authRateLimit, makeProxy(env.TRUCKER_SERVICE_URL, '/api/v1'));
router.post('/auth/refresh', authRateLimit, makeProxy(env.TRUCKER_SERVICE_URL, '/api/v1'));

// =============================================================
// PROTECTED ROUTES (JWT required)
// =============================================================

// Auth
router.get('/auth/me', authMiddleware, makeProxy(env.TRUCKER_SERVICE_URL, '/api/v1'));
router.post('/auth/logout', authMiddleware, makeProxy(env.TRUCKER_SERVICE_URL, '/api/v1'));

// KYC — router.use strips /kyc, proxy sees remaining path
router.use('/kyc', authMiddleware, makeProxy(env.TRUCKER_SERVICE_URL, '/api/v1/kyc'));

// Loads
router.use('/loads', authMiddleware, makeProxy(env.LOAD_SERVICE_URL, '/api/v1/loads'));

// Pricing
router.use('/pricing', authMiddleware, makeProxy(env.PRICING_SERVICE_URL, '/api/v1/pricing'));

// Tracking
router.use('/tracking', authMiddleware, makeProxy(env.TRUCKER_SERVICE_URL, '/api/v1/tracking'));

// Truckers
router.use('/truckers', authMiddleware, makeProxy(env.TRUCKER_SERVICE_URL, '/api/v1/truckers'));

// Payments
router.use('/payments', authMiddleware, makeProxy(env.PAYMENT_SERVICE_URL, '/api/v1/payments'));

// Notifications
router.use('/notifications', authMiddleware, makeProxy(env.NOTIFICATION_SERVICE_URL, '/api/v1/notifications'));

// Ratings
router.use('/ratings', authMiddleware, makeProxy(env.LOAD_SERVICE_URL, '/api/v1/ratings'));

// Disputes
router.use('/disputes', authMiddleware, makeProxy(env.LOAD_SERVICE_URL, '/api/v1/disputes'));

// Social (admin + merchant only)
router.use(
  '/social',
  authMiddleware,
  requireRole('admin', 'merchant'),
  makeProxy(env.SOCIAL_SERVICE_URL, '/api/v1/social'),
);

// Admin (admin only)
router.use(
  '/admin',
  authMiddleware,
  requireRole('admin'),
  makeProxy(env.ADMIN_SERVICE_URL, '/api/v1/admin'),
);

export { router as proxyRoutes };
