// CRITICAL: Set NODE_ENV before imports to prevent dotenv from loading .env
// This allows testcontainers to start when DATABASE_URL is unset
process.env.NODE_ENV = 'test';

import { afterAll, beforeAll, vi } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { createLogger } from '@dialogue-constructor/shared';
import { initPostgres, closePostgres } from '../db/postgres';
import { initializeBotsTable } from '../db/bots';
import { initRedis, closeRedis } from '../db/redis';
import { TelegramApiMock } from './telegram-api-mock';

const telegramApiMock = new TelegramApiMock();
(globalThis as any).__telegramApiMock = telegramApiMock;

// Intercept Telegram Bot API calls made by Telegraf (it uses node-fetch internally).
vi.mock('node-fetch', async () => {
  const actual: any = await vi.importActual('node-fetch');

  const fetchMock: any = async (url: any, config: any) => {
    const tg = (globalThis as any).__telegramApiMock as TelegramApiMock | undefined;
    const urlStr = typeof url === 'string' ? url : url?.toString?.() ?? String(url);
    const methodName = (() => {
      try {
        const u = new URL(urlStr);
        const parts = u.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] ?? '';
      } catch {
        const parts = urlStr.split('/').filter(Boolean);
        return parts[parts.length - 1] ?? '';
      }
    })();

    const bodyRaw = config?.body;
    let payload: any = {};
    if (typeof bodyRaw === 'string') {
      try {
        payload = JSON.parse(bodyRaw);
      } catch {
        payload = {};
      }
    }

    if (tg) {
      if (methodName === 'sendMessage') {
        const { chat_id, text, ...extra } = payload ?? {};
        tg.mockSendMessage(Number(chat_id), String(text ?? ''), extra);
      } else if (methodName === 'editMessageText') {
        const { chat_id, message_id, text } = payload ?? {};
        tg.mockEditMessageText(Number(chat_id), Number(message_id), String(text ?? ''));
      } else if (methodName === 'answerCallbackQuery') {
        const { callback_query_id } = payload ?? {};
        tg.mockAnswerCallbackQuery(String(callback_query_id ?? ''));
      } else {
        tg.sentMessages.push({ method: String(methodName), payload });
      }
    }

    const result = (() => {
      if (methodName === 'sendMessage' || methodName === 'editMessageText') {
        return {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: { id: payload?.chat_id ?? 0, type: 'private' },
          text: payload?.text ?? '',
        };
      }
      if (methodName === 'answerCallbackQuery') {
        return true;
      }
      return {};
    })();

    return {
      status: 200,
      statusText: 'OK',
      json: async () => ({ ok: true, result }),
    };
  };

  // Keep compatibility with CJS default import patterns
  Object.assign(fetchMock, actual);
  fetchMock.default = fetchMock;
  return fetchMock;
});

let postgresContainer: StartedTestContainer | null = null;
let redisContainer: StartedTestContainer | null = null;

if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = 'test_encryption_key_32_chars_long';
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    try {
      const postgres = await new GenericContainer('postgres:15')
        .withExposedPorts(5432)
        .withEnvironment({
          POSTGRES_DB: 'test_db',
          POSTGRES_USER: 'postgres',
          POSTGRES_PASSWORD: 'test_password',
        })
        .start();
      postgresContainer = postgres;
      process.env.DATABASE_URL = `postgresql://postgres:test_password@${postgres.getHost()}:${postgres.getMappedPort(5432)}/test_db`;
    } catch {
      throw new Error('Docker required for integration tests or set DATABASE_URL');
    }
  }

  if (!process.env.REDIS_URL) {
    const redis = await new GenericContainer('redis:7')
      .withExposedPorts(6379)
      .start();
    redisContainer = redis;
    process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
  }

  const logger = createLogger('test-setup');
  await initPostgres(logger);
  await initializeBotsTable();
  await initRedis(logger);
}, 60000);

afterAll(async () => {
  await closePostgres();
  await closeRedis();

  if (postgresContainer) {
    await postgresContainer.stop();
    postgresContainer = null;
  }
  if (redisContainer) {
    await redisContainer.stop();
    redisContainer = null;
  }
}, 60000);
