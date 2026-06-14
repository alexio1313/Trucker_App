import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string(),
  MONGODB_URI: z.string(),
  REDIS_URL: z.string().url(),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  JWT_ACCESS_SECRET: z.string().min(32),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().default(5),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${parsed.error.toString()}`);
}

export const env = parsed.data;
