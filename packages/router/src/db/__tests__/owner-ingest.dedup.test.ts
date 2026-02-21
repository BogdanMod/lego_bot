/**
 * Тесты идемпотентности ingest: не создавать дубли lead/appointment для одного (bot_id, customer_id) за 10 минут.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPostgresPool, initPostgres, closePostgres } from '../postgres';
import { createLogger } from '@dialogue-constructor/shared';
import { ingestOwnerEvent } from '../owner-ingest';
import { createTestPostgresPool, cleanupAllTestState, seedTestData } from '../../test-utils/db-helpers';
import { getRedisClientOptional, initRedis, closeRedis, resetInMemoryStateForTests } from '../redis';
import { encryptToken } from '../../utils/encryption';

const encryptionKey = process.env.ENCRYPTION_KEY || 'test-encryption-key-32bytes!!';
const testBotId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
const testUserId = 999888;

async function countLeads(botId: string): Promise<number> {
  const pool = getPostgresPool();
  const r = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text as count FROM leads WHERE bot_id = $1',
    [botId]
  );
  return Number(r.rows[0]?.count ?? 0);
}

async function countAppointments(botId: string): Promise<number> {
  const pool = getPostgresPool();
  const r = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text as count FROM appointments WHERE bot_id = $1',
    [botId]
  );
  return Number(r.rows[0]?.count ?? 0);
}

describe('owner-ingest 10-min dedup', () => {
  let pool: ReturnType<typeof createTestPostgresPool>;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = encryptionKey;
    pool = createTestPostgresPool();
    const logger = createLogger('owner-ingest-dedup-test');
    await initPostgres(logger);
    await initRedis(logger);
  });

  beforeEach(async () => {
    const redis = await getRedisClientOptional();
    await cleanupAllTestState(pool, redis, resetInMemoryStateForTests);
  });

  afterAll(async () => {
    if (pool) await pool.end();
    await closePostgres();
    await closeRedis();
  });

  it('не создаёт второй lead для того же (bot_id, customer_id) в течение 10 минут', async () => {
    await seedTestData(pool, [
      {
        id: testBotId,
        userId: testUserId,
        token: encryptToken('token', encryptionKey),
        name: 'Dedup Bot',
        webhookSecret: 'secret',
      },
    ]);

    const params = {
      botId: testBotId,
      sourceId: 'tg:100:callback_query',
      type: 'message_received' as const,
      telegramUserId: 777,
      customerName: 'Test User',
      messageText: 'confirm',
      payload: { updateType: 'callback_query', updateId: 100 },
      profile: { first_name: 'Test', last_name: 'User' },
    };

    await ingestOwnerEvent(params, { trackEvent: 'lead' });
    expect(await countLeads(testBotId)).toBe(1);

    await ingestOwnerEvent(
      { ...params, sourceId: 'tg:101:callback_query' },
      { trackEvent: 'lead' }
    );
    expect(await countLeads(testBotId)).toBe(1);
  });

  it('не создаёт второй appointment для того же (bot_id, customer_id) в течение 10 минут', async () => {
    await seedTestData(pool, [
      {
        id: testBotId,
        userId: testUserId,
        token: encryptToken('token', encryptionKey),
        name: 'Dedup Bot',
        webhookSecret: 'secret',
      },
    ]);

    const params = {
      botId: testBotId,
      sourceId: 'tg:200:callback_query',
      type: 'message_received' as const,
      telegramUserId: 888,
      customerName: 'App User',
      messageText: 'thanks',
      payload: { updateType: 'callback_query', updateId: 200 },
      profile: { first_name: 'App', last_name: 'User' },
    };

    await ingestOwnerEvent(params, { trackEvent: 'appointment' });
    expect(await countAppointments(testBotId)).toBe(1);

    await ingestOwnerEvent(
      { ...params, sourceId: 'tg:201:callback_query' },
      { trackEvent: 'appointment' }
    );
    expect(await countAppointments(testBotId)).toBe(1);
  });
});
