import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  JWT_ACCESS_SECRET: z.string().min(32),
  REDIS_URL: z.string().url(),

  // Downstream service URLs
  LOAD_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  TRUCKER_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  PRICING_SERVICE_URL: z.string().url().default('http://localhost:3003'),
  NOTIFICATION_SERVICE_URL: z.string().url().default('http://localhost:3004'),
  PAYMENT_SERVICE_URL: z.string().url().default('http://localhost:3005'),
  SOCIAL_SERVICE_URL: z.string().url().default('http://localhost:3006'),
  ADMIN_SERVICE_URL: z.string().url().default('http://localhost:3007'),
  ML_SERVICE_URL: z.string().url().default('http://localhost:3008'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),

  CORS_ORIGIN: z.string().default('*'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${parsed.error.toString()}`);
}

export const env = parsed.data;
