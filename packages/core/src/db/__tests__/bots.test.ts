import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'crypto';
import { WEBHOOK_LIMITS } from '@dialogue-constructor/shared';
import {
  botExistsByToken,
  createBot,
  deleteBot,
  getBotById,
  getBotByWebhookSecret,
  getBotsByUserId,
  setBotWebhookSecret,
  updateBotSchema,
  updateWebhookStatus,
} from '../bots';
import { getPostgresClient } from '../postgres';
import { getRedisClientOptional } from '../redis';

const TEST_RUN_ID = crypto.randomUUID();
const USER_ID_BASE = Number.parseInt(TEST_RUN_ID.replace(/-/g, '').slice(0, 10), 16);
const redisKeyPrefix = `test:${TEST_RUN_ID}:`;

let userIdCounter = 0;
let currentUserId = USER_ID_BASE;
const createdBotIds: string[] = [];

async function cleanupDatabase(userId: number): Promise<void> {
  const client = await getPostgresClient();
  try {
    await client.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM bots WHERE user_id = $1', [userId]);
  } finally {
    client.release();
  }
}

async function cleanupRedis(botIds: string[]): Promise<void> {
  const client = await getRedisClientOptional();
  if (!client) {
    return;
  }

  const keysToDelete = new Set<string>();

  let cursor = 0;
  do {
    const { cursor: nextCursor, keys } = await client.scan(cursor, { MATCH: `${redisKeyPrefix}*`, COUNT: 100 });
    cursor = parseInt(String(nextCursor ?? 0), 10) || 0;
    for (const key of keys ?? []) {
      keysToDelete.add(key);
    }
  } while (cursor !== 0);

  for (const botId of botIds) {
    keysToDelete.add(`bot:${botId}:schema`);
  }

  if (keysToDelete.size > 0) {
    await client.del([...keysToDelete]);
  }
}

async function createTestBot(token: string, name: string) {
  const bot = await createBot({ user_id: currentUserId, token, name });
  createdBotIds.push(bot.id);
  return bot;
}

beforeEach(async () => {
  currentUserId = USER_ID_BASE + userIdCounter;
  userIdCounter += 1;
  createdBotIds.length = 0;
  await cleanupDatabase(currentUserId);
  await cleanupRedis(createdBotIds);
});

afterEach(async () => {
  await cleanupDatabase(currentUserId);
  await cleanupRedis(createdBotIds);
});

describe('bots CRUD operations', () => {
  describe('createBot', () => {
    it('should create bot with valid data', async () => {
      const result = await createTestBot('encrypted-token', 'Test Bot');

      expect(result.id).toBeTruthy();
      expect(String(result.user_id)).toBe(String(currentUserId));
      expect(result.token).toBe('encrypted-token');
      expect(result.name).toBe('Test Bot');
      expect(result.webhook_set).toBe(false);
      expect(result.schema).toBeNull();
      expect(result.schema_version).toBe(0);
      expect(result.webhook_secret).toBeTruthy();
      expect(result.webhook_secret?.length).toBe(WEBHOOK_LIMITS.SECRET_TOKEN_LENGTH * 2);
    });
  });

  describe('getBotsByUserId', () => {
    it('should return bots for user', async () => {
      const botA = await createTestBot('t1', 'Bot 1');
      const botB = await createTestBot('t2', 'Bot 2');

      const result = await getBotsByUserId(currentUserId);

      expect(result).toHaveLength(2);
      expect(result.map((bot) => bot.id)).toEqual(expect.arrayContaining([botA.id, botB.id]));
    });
  });

  describe('getBotById', () => {
    it('should return bot when found', async () => {
      const bot = await createTestBot('t1', 'Bot 1');

      const result = await getBotById(bot.id, currentUserId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(bot.id);
      expect(String(result?.user_id)).toBe(String(currentUserId));
      expect(result?.name).toBe('Bot 1');
    });

    it('should return null when not found', async () => {
      const result = await getBotById('00000000-0000-0000-0000-000000000000', currentUserId);

      expect(result).toBeNull();
    });
  });

  describe('botExistsByToken', () => {
    it('should return true when token exists', async () => {
      await createTestBot('token', 'Bot');

      const result = await botExistsByToken('token');

      expect(result).toBe(true);
    });

    it('should return false when token missing', async () => {
      const result = await botExistsByToken('missing');

      expect(result).toBe(false);
    });
  });

  describe('getBotByWebhookSecret', () => {
    it('should return bot when secret matches', async () => {
      const bot = await createTestBot('token', 'Bot');

      const result = await getBotByWebhookSecret(bot.webhook_secret as string);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(bot.id);
    });

    it('should return null when secret missing', async () => {
      const result = await getBotByWebhookSecret('missing');

      expect(result).toBeNull();
    });
  });

  describe('setBotWebhookSecret', () => {
    it('should update webhook secret', async () => {
      const bot = await createTestBot('token', 'Bot');

      const result = await setBotWebhookSecret(bot.id, currentUserId, 'secret');
      const updated = await getBotById(bot.id, currentUserId);

      expect(result).toBe(true);
      expect(updated?.webhook_secret).toBe('secret');
    });

    it('should return false when no rows updated', async () => {
      const result = await setBotWebhookSecret('00000000-0000-0000-0000-000000000000', currentUserId, 'secret');

      expect(result).toBe(false);
    });
  });

  describe('deleteBot', () => {
    it('should soft delete bot (is_active = false)', async () => {
      const bot = await createTestBot('token', 'Bot');

      const result = await deleteBot(bot.id, currentUserId);
      const fetched = await getBotById(bot.id, currentUserId);

      expect(result).toBe(true);
      expect(fetched).toBeNull(); // getBotById фильтрует по is_active = true
    });

    it('should return false when bot not found', async () => {
      const result = await deleteBot('00000000-0000-0000-0000-000000000000', currentUserId);

      expect(result).toBe(false);
    });

    it('should exclude deleted bots from limit count', async () => {
      const { BOT_LIMITS } = await import('@dialogue-constructor/shared');
      const { countActiveBotsByUserId } = await import('../bots');
      
      // Создаем 5 ботов (лимит)
      const bots = [];
      for (let i = 0; i < BOT_LIMITS.MAX_BOTS_PER_USER; i++) {
        bots.push(await createTestBot(`token-${i}`, `Bot ${i}`));
      }
      
      // Проверяем что лимит достигнут
      let count = await countActiveBotsByUserId(currentUserId);
      expect(count).toBe(BOT_LIMITS.MAX_BOTS_PER_USER);
      
      // Удаляем все 5 ботов
      for (const bot of bots) {
        await deleteBot(bot.id, currentUserId);
      }
      
      // Проверяем что count = 0
      count = await countActiveBotsByUserId(currentUserId);
      expect(count).toBe(0);
      
      // Создание нового бота должно пройти
      const newBot = await createTestBot('new-token', 'New Bot');
      expect(newBot).toBeTruthy();
      
      count = await countActiveBotsByUserId(currentUserId);
      expect(count).toBe(1);
    });

    it('should prevent race condition with parallel bot creation', async () => {
      const { BOT_LIMITS } = await import('@dialogue-constructor/shared');
      const { countActiveBotsByUserId, BotLimitError } = await import('../bots');
      
      // Создаем ботов до лимита - 1
      const bots = [];
      for (let i = 0; i < BOT_LIMITS.MAX_BOTS_PER_USER - 1; i++) {
        bots.push(await createTestBot(`token-${i}`, `Bot ${i}`));
      }
      
      // Проверяем что осталось место для 1 бота
      let count = await countActiveBotsByUserId(currentUserId);
      expect(count).toBe(BOT_LIMITS.MAX_BOTS_PER_USER - 1);
      
      // Барьер запуска: создаем массив промисов, которые стартуют одновременно
      const parallelCount = 10;
      const promises: Promise<any>[] = [];
      
      // Запускаем все промисы одновременно через Promise.allSettled
      const results = await Promise.allSettled(
        Array.from({ length: parallelCount }, (_, i) =>
          createTestBot(`parallel-token-${i}`, `Parallel Bot ${i}`)
        )
      );
      
      // Один должен быть успешным, остальные - отклонены
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(parallelCount - 1);
      
      // Проверяем что в БД ровно MAX_BOTS_PER_USER ботов (не больше, не меньше)
      count = await countActiveBotsByUserId(currentUserId);
      expect(count).toBe(BOT_LIMITS.MAX_BOTS_PER_USER);
      
      // Проверяем что все отклоненные запросы вернули BotLimitError
      const rejectedReasons = rejected
        .map(r => (r as PromiseRejectedResult).reason);
      
      const allLimitErrors = rejectedReasons.every(
        (reason: any) => reason instanceof BotLimitError || reason?.message?.includes('Bot limit reached')
      );
      expect(allLimitErrors).toBe(true);
      
      // Дополнительная проверка: убеждаемся что ни один запрос не создал лишнего бота
      // (count должен быть ровно limit, не больше)
      expect(count).toBeLessThanOrEqual(BOT_LIMITS.MAX_BOTS_PER_USER);
    });
  });

  describe('updateWebhookStatus', () => {
    it('should update webhook_set flag', async () => {
      const bot = await createTestBot('token', 'Bot');

      const result = await updateWebhookStatus(bot.id, currentUserId, true);
      const updated = await getBotById(bot.id, currentUserId);

      expect(result).toBe(true);
      expect(updated?.webhook_set).toBe(true);
    });
  });

  describe('updateBotSchema', () => {
    it('should update schema and increment version', async () => {
      const bot = await createTestBot('token', 'Bot');
      const schema = { version: 1, states: { start: { message: 'Hi' } }, initialState: 'start' };

      const result = await updateBotSchema(bot.id, currentUserId, schema as any);
      const updated = await getBotById(bot.id, currentUserId);

      expect(result).toBe(true);
      expect(updated?.schema).toEqual(schema);
      expect(updated?.schema_version).toBe(1);
    });
  });
});
