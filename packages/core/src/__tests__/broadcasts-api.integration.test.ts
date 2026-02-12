import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import crypto from 'crypto';
import { createApp } from '../index';
import { encryptToken } from '../utils/encryption';
import { createTestPostgresPool, cleanupAllTestState, seedTestData } from '../../test-utils/db-helpers';
import { authenticateRequest } from '../../test-utils/api-helpers';
import { getRedisClientOptional } from '../db/redis';

const app = createApp();
const request = supertest.agent(app);
let pool: ReturnType<typeof createTestPostgresPool>;
const encryptionKey = process.env.ENCRYPTION_KEY as string;
const botToken = process.env.TELEGRAM_BOT_TOKEN || 'test-bot-token';
let previousTelegramBotToken: string | undefined;
let previousBotToken: string | undefined;
const rateLimitCooldownMs = 1500;

async function seedBotUsers(botId: string, telegramIds: string[]) {
  for (const telegramId of telegramIds) {
    await pool.query(
      `INSERT INTO bot_users (
        bot_id,
        telegram_user_id,
        first_name,
        last_name,
        username,
        phone_number,
        email,
        language_code,
        first_interaction_at,
        last_interaction_at,
        interaction_count,
        metadata
      )
      VALUES ($1, $2::bigint, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, $9)`,
      [botId, telegramId, 'Test', null, null, null, null, null, null]
    );
  }
}

beforeEach(async () => {
  process.env.TELEGRAM_BOT_TOKEN = botToken;
  const redisClient = await getRedisClientOptional();
  await cleanupAllTestState(pool, redisClient);
  await new Promise((resolve) => setTimeout(resolve, rateLimitCooldownMs));
});

beforeAll(async () => {
  previousTelegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  previousBotToken = process.env.BOT_TOKEN;
  pool = createTestPostgresPool();

  const { initializeRateLimiters } = await import('../index');
  await initializeRateLimiters();
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
});

afterEach(() => {
  if (previousTelegramBotToken === undefined) {
    delete process.env.TELEGRAM_BOT_TOKEN;
  } else {
    process.env.TELEGRAM_BOT_TOKEN = previousTelegramBotToken;
  }
  if (previousBotToken === undefined) {
    delete process.env.BOT_TOKEN;
  } else {
    process.env.BOT_TOKEN = previousBotToken;
  }
});

describe('Broadcasts API', () => {
  it('creates broadcast and returns total recipients', async () => {
    const botId = crypto.randomUUID();
    await seedTestData(pool, [
      {
        id: botId,
        userId: 1,
        token: encryptToken('token-broadcast', encryptionKey),
        name: 'Broadcast Bot',
      },
    ]);
    await seedBotUsers(botId, ['1001', '1002']);

    const response = await authenticateRequest(
      request.post(`/api/bot/${botId}/broadcasts`).send({
        name: 'New Broadcast',
        message: 'Hello',
        parseMode: 'HTML',
      }),
      1,
      botToken
    );

    expect(response.status).toBe(200);
    expect(response.body.total_recipients).toBe(2);
    expect(response.body.status).toBe('draft');
  });

  it('returns broadcasts list', async () => {
    const botId = crypto.randomUUID();
    await seedTestData(pool, [
      {
        id: botId,
        userId: 1,
        token: encryptToken('token-broadcast-list', encryptionKey),
        name: 'Broadcast Bot',
      },
    ]);

    await authenticateRequest(
      request.post(`/api/bot/${botId}/broadcasts`).send({
        name: 'List Broadcast',
        message: 'Hello',
      }),
      1,
      botToken
    );

    const response = await authenticateRequest(
      request.get(`/api/bot/${botId}/broadcasts`),
      1,
      botToken
    );

    expect(response.status).toBe(200);
    expect(response.body.broadcasts.length).toBe(1);
  });

  it('starts broadcast', async () => {
    const botId = crypto.randomUUID();
    await seedTestData(pool, [
      {
        id: botId,
        userId: 1,
        token: encryptToken('token-broadcast-start', encryptionKey),
        name: 'Broadcast Bot',
      },
    ]);

    const createResponse = await authenticateRequest(
      request.post(`/api/bot/${botId}/broadcasts`).send({
        name: 'Start Broadcast',
        message: 'Hello',
      }),
      1,
      botToken
    );

    const broadcastId = createResponse.body.id;
    const response = await authenticateRequest(
      request.post(`/api/bot/${botId}/broadcasts/${broadcastId}/start`),
      1,
      botToken
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('cancels broadcast', async () => {
    const botId = crypto.randomUUID();
    await seedTestData(pool, [
      {
        id: botId,
        userId: 1,
        token: encryptToken('token-broadcast-cancel', encryptionKey),
        name: 'Broadcast Bot',
      },
    ]);

    const createResponse = await authenticateRequest(
      request.post(`/api/bot/${botId}/broadcasts`).send({
        name: 'Cancel Broadcast',
        message: 'Hello',
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
      1,
      botToken
    );

    const broadcastId = createResponse.body.id;
    const cancelResponse = await authenticateRequest(
      request.post(`/api/bot/${botId}/broadcasts/${broadcastId}/cancel`),
      1,
      botToken
    );

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.success).toBe(true);
  });
});
