import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../logger';

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 20 });
pool.on('error', (err) => logger.error('PostgreSQL error', { error: err.message }));

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}
