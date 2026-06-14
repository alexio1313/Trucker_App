import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const globalRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  },
  keyGenerator: (req) => req.headers['x-forwarded-for']?.toString() ?? req.ip ?? 'unknown',
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts' },
  },
  keyGenerator: (req) => req.headers['x-forwarded-for']?.toString() ?? req.ip ?? 'unknown',
});
