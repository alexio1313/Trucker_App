import { Kafka, Producer } from 'kafkajs';
import { env } from '../config/env';
import { logger } from '../logger';

const kafka = new Kafka({
  clientId: 'load-service',
  brokers: env.KAFKA_BROKERS.split(','),
});

let producer: Producer | null = null;

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
    logger.info('Kafka producer connected');
  }
  return producer;
}

export async function publishEvent(topic: string, payload: unknown): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic,
    messages: [{ value: JSON.stringify(payload), timestamp: Date.now().toString() }],
  });
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
