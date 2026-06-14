import { Router, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ClientRequest, IncomingMessage } from 'http';
import { env } from '../config/env';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { authRateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Express strips /api/v1 when routing into this sub-router.
// Re-inject the parsed body (consumed by express.json) and restore the /api/v1 prefix.
function injectBody(proxyReq: ClientRequest, req: IncomingMessage): void {
  const expressReq = req as Request;
  if (expressReq.body && Object.keys(expressReq.body).length > 0) {
    const bodyData = JSON.stringify(expressReq.body);
    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
    proxyReq.end();
  }
}

function makeProxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { '^/': '/api/v1/' },
    on: {
      proxyReq: injectBody,
      error: (err, req, res) => {
        (res as Response).status(502).json({
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

router.post('/auth/register', authRateLimit, makeProxy(env.TRUCKER_SERVICE_URL));
router.post('/auth/login', authRateLimit, makeProxy(env.TRUCKER_SERVICE_URL));
router.post('/auth/send-otp', authRateLimit, makeProxy(env.TRUCKER_SERVICE_URL));
router.post('/auth/verify-otp', authRateLimit, makeProxy(env.TRUCKER_SERVICE_URL));
router.post('/auth/refresh', authRateLimit, makeProxy(env.TRUCKER_SERVICE_URL));

// =============================================================
// PROTECTED ROUTES (JWT required)
// =============================================================

router.get('/auth/me', authMiddleware, makeProxy(env.TRUCKER_SERVICE_URL));
router.post('/auth/logout', authMiddleware, makeProxy(env.TRUCKER_SERVICE_URL));

router.use('/kyc', authMiddleware, makeProxy(env.TRUCKER_SERVICE_URL));
router.use('/loads', authMiddleware, makeProxy(env.LOAD_SERVICE_URL));
router.use('/pricing', authMiddleware, makeProxy(env.PRICING_SERVICE_URL));
router.use('/tracking', authMiddleware, makeProxy(env.TRUCKER_SERVICE_URL));
router.use('/truckers', authMiddleware, makeProxy(env.TRUCKER_SERVICE_URL));
router.use('/payments', authMiddleware, makeProxy(env.PAYMENT_SERVICE_URL));
router.use('/notifications', authMiddleware, makeProxy(env.NOTIFICATION_SERVICE_URL));
router.use('/ratings', authMiddleware, makeProxy(env.LOAD_SERVICE_URL));
router.use('/disputes', authMiddleware, makeProxy(env.LOAD_SERVICE_URL));

router.use(
  '/social',
  authMiddleware,
  requireRole('admin', 'merchant'),
  makeProxy(env.SOCIAL_SERVICE_URL),
);

router.use(
  '/admin',
  authMiddleware,
  requireRole('admin'),
  makeProxy(env.ADMIN_SERVICE_URL),
);

export { router as proxyRoutes };
