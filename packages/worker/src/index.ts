import 'dotenv/config';
import { getRedisClient } from './db/redis.js';
import { getPostgresClient } from './db/postgres.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const CONSUMER_GROUP = 'event-processors';
const CONSUMER_NAME = `worker-${process.pid}`;
const STREAM_NAME = 'events';
const DLQ_STREAM = 'events:dead';
const BATCH_SIZE = 10;
const BLOCK_MS = 5000;

async function ensureConsumerGroup(redis: any) {
  try {
    await redis.xGroupCreate(STREAM_NAME, CONSUMER_GROUP, '0', { MKSTREAM: true });
    logger.info('Created consumer group', { group: CONSUMER_GROUP });
  } catch (error: any) {
    if (error.message?.includes('BUSYGROUP')) {
      logger.debug('Consumer group already exists');
    } else {
      throw error;
    }
  }
}

async function processEvent(eventData: Record<string, string>, eventId: string) {
  const botId = eventData.bot_id;
  const eventType = eventData.type;
  const entityType = eventData.entity_type;
  const entityId = eventData.entity_id;
  
  if (!botId) {
    throw new Error('Missing bot_id in event');
  }

  const client = await getPostgresClient();
  try {
    // Обновляем entities на основе события
    if (entityType && entityId) {
      if (entityType === 'customer') {
        await client.query(
          `UPDATE customers SET updated_at = now() WHERE bot_id = $1 AND id = $2::uuid`,
          [botId, entityId]
        );
      } else if (entityType === 'lead') {
        await client.query(
          `UPDATE leads SET updated_at = now() WHERE bot_id = $1 AND id = $2::uuid`,
          [botId, entityId]
        );
      } else if (entityType === 'order') {
        await client.query(
          `UPDATE orders SET updated_at = now() WHERE bot_id = $1 AND id = $2::uuid`,
          [botId, entityId]
        );
      } else if (entityType === 'appointment') {
        await client.query(
          `UPDATE appointments SET updated_at = now() WHERE bot_id = $1 AND id = $2::uuid`,
          [botId, entityId]
        );
      }
    }

    // Обновляем bot_events: processed_at и status
    await client.query(
      `UPDATE bot_events 
       SET processed_at = now(), status = CASE WHEN status = 'new' THEN 'in_progress' ELSE status END
       WHERE bot_id = $1 AND id = $2::uuid`,
      [botId, eventData.event_id]
    );

    // v2: Публикуем событие в Redis PubSub для SSE
    try {
      const redis = await getRedisClient();
      const channel = `bot:${botId}:events`;
      await redis.publish(channel, JSON.stringify({
        event_id: eventData.event_id,
        type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        bot_id: botId,
        processed_at: new Date().toISOString(),
      }));
    } catch (pubError) {
      logger.warn('Failed to publish event to PubSub', { botId, eventId, error: pubError });
    }

    logger.info('Event processed', { botId, eventId, eventType, entityType });
  } finally {
    client.release();
  }
}

async function sendToDLQ(redis: any, eventId: string, eventData: Record<string, string>, error: Error) {
  try {
    await redis.xAdd(DLQ_STREAM, '*', {
      original_event_id: eventId,
      original_stream: STREAM_NAME,
      error_code: 'PROCESSING_FAILED',
      error_message: error.message,
      bot_id: eventData.bot_id || '',
      type: eventData.type || '',
      failed_at: new Date().toISOString(),
      ...eventData,
    });
    logger.warn('Event sent to DLQ', { eventId, error: error.message });
  } catch (dlqError) {
    logger.error('Failed to send event to DLQ', { eventId, error: dlqError });
  }
}

async function processBatch(redis: any) {
  try {
    const messages = await redis.xReadGroup(
      CONSUMER_GROUP,
      CONSUMER_NAME,
      [{ key: STREAM_NAME, id: '>' }],
      { COUNT: BATCH_SIZE, BLOCK: BLOCK_MS }
    );

    if (!messages || messages.length === 0) {
      return;
    }

    for (const stream of messages) {
      for (const message of stream.messages) {
        const eventId = message.id;
        const eventData: Record<string, string> = {};
        
        for (let i = 0; i < message.message.length; i += 2) {
          eventData[message.message[i]] = message.message[i + 1];
        }

        let retries = 0;
        const maxRetries = 3;
        let success = false;

        while (retries < maxRetries && !success) {
          try {
            await processEvent(eventData, eventId);
            await redis.xAck(STREAM_NAME, CONSUMER_GROUP, eventId);
            success = true;
            logger.debug('Event acknowledged', { eventId });
          } catch (error: any) {
            retries++;
            logger.warn('Event processing failed', { eventId, retry: retries, error: error.message });
            
            if (retries >= maxRetries) {
              await sendToDLQ(redis, eventId, eventData, error);
              await redis.xAck(STREAM_NAME, CONSUMER_GROUP, eventId); // ACK даже при ошибке, чтобы не зациклиться
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
            }
          }
        }
      }
    }
  } catch (error: any) {
    if (error.message?.includes('NOGROUP')) {
      logger.info('Consumer group not found, creating...');
      await ensureConsumerGroup(redis);
    } else {
      logger.error('Error processing batch', { error: error.message });
    }
  }
}

async function main() {
  logger.info('Starting worker', { consumer: CONSUMER_NAME, group: CONSUMER_GROUP });
  
  const redis = await getRedisClient();
  await ensureConsumerGroup(redis);

  // Main loop
  while (true) {
    try {
      await processBatch(redis);
    } catch (error: any) {
      logger.error('Fatal error in main loop', { error: error.message });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});

