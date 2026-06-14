import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3003),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().url(),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  GOOGLE_MAPS_API_KEY: z.string(),
  TRAVELTIME_APP_ID: z.string().optional(),
  TRAVELTIME_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  CLAUDE_API_KEY: z.string().optional(),
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().default(5),
  MAX_SURGE_MULTIPLIER: z.coerce.number().default(1.5),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${parsed.error.toString()}`);
}

export const env = parsed.data;
