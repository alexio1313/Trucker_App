import { MongoClient, Db, Collection } from 'mongodb';
import { env } from '../config/env';
import { logger } from '../logger';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  db = client.db('truck_platform');
  logger.info('MongoDB connected (social-publishing)');
  return db;
}

export async function getCollection<T extends object>(name: string): Promise<Collection<T>> {
  const database = await getDb();
  return database.collection<T>(name);
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
