import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3008),
  DATABASE_URL: z.string(),
  MONGODB_URI: z.string(),
  REDIS_URL: z.string().url(),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  OLLAMA_BASE_URL: z.string().default('http://ollama:11434'),
  OLLAMA_MODEL: z.string().default('mistral:7b'),
  CLAUDE_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string(),
  FRAUD_SCORE_THRESHOLD: z.coerce.number().default(0.7),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${parsed.error.toString()}`);
}

export const env = parsed.data;
