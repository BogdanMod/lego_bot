import { vi } from 'vitest';

vi.mock('../services/telegram', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({}),
  sendTelegramMessageWithKeyboard: vi.fn().mockResolvedValue({}),
  sendTelegramMessageWithReplyKeyboard: vi.fn().mockResolvedValue({}),
  sendTelegramMessageWithReplyKeyboardRemove: vi.fn().mockResolvedValue({}),
  sendPhoto: vi.fn().mockResolvedValue(1),
  sendVideo: vi.fn().mockResolvedValue(1),
  sendDocument: vi.fn().mockResolvedValue(1),
  sendAudio: vi.fn().mockResolvedValue(1),
  sendMediaGroup: vi.fn().mockResolvedValue(1),
  answerCallbackQuery: vi.fn().mockResolvedValue({}),
}));

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'crypto';
import supertest from 'supertest';
import { createLogger } from '@dialogue-constructor/shared';
import { createApp } from '../index';
import { encryptToken } from '../utils/encryption';
import { initPostgres, closePostgres } from '../db/postgres';
import { initRedis, closeRedis, resetInMemoryStateForTests } from '../db/redis';
import { createTestPostgresPool, cleanupTestDatabase, seedTestData } from '../../../shared/src/test-utils/db-helpers';
import { createMockBotSchema, createMockTelegramUpdate } from '../../../shared/src/test-utils/mock-factories';

import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  sendPhoto,
  sendVideo,
  sendMediaGroup,
} from '../services/telegram';

const app = createApp();
const request = supertest(app);
const encryptionKey = process.env.ENCRYPTION_KEY as string;
let pool: ReturnType<typeof createTestPostgresPool>;

const webhookSecret = 'test-secret';

async function sendWebhook(body: any, botId: string, secret = webhookSecret) {
  return request
    .post(`/webhook/${botId}`)
    .set('x-telegram-bot-api-secret-token', secret)
    .send(body);
}

beforeAll(async () => {
  pool = createTestPostgresPool();
  const logger = createLogger('router-test');
  await initPostgres(logger);
  await initRedis(logger);

  const { initializeRateLimiters } = await import('../index');
  await initializeRateLimiters();
});

beforeEach(async () => {
  await cleanupTestDatabase(pool);
  resetInMemoryStateForTests();
  vi.clearAllMocks();
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
  await closePostgres();
  await closeRedis();
});

describe('POST /webhook/:botId media handling', () => {
  it('sends photo message', async () => {
    const botId = crypto.randomUUID();
    await seedTestData(pool, [
      {
        id: botId,
        userId: 1,
        token: encryptToken('token', encryptionKey),
        name: 'Bot',
        webhookSecret,
        schema: createMockBotSchema({
          initialState: 'photo',
          states: {
            photo: {
              message: 'Photo',
              media: { type: 'photo', url: 'https://example.com/photo.jpg' },
            },
          },
        }),
      },
    ]);

    const response = await sendWebhook(createMockTelegramUpdate(), botId);

    expect(response.status).toBe(200);
    expect(sendPhoto).toHaveBeenCalled();
  });

  it('sends video message', async () => {
    const botId = crypto.randomUUID();
    await seedTestData(pool, [
      {
        id: botId,
        userId: 1,
        token: encryptToken('token', encryptionKey),
        name: 'Bot',
        webhookSecret,
        schema: createMockBotSchema({
          initialState: 'video',
          states: {
            video: {
              message: 'Video',
              media: { type: 'video', url: 'https://example.com/video.mp4' },
            },
          },
        }),
      },
    ]);

    const response = await sendWebhook(createMockTelegramUpdate({ update_id: 2 }), botId);

    expect(response.status).toBe(200);
    expect(sendVideo).toHaveBeenCalled();
  });

  it('sends media group and separate text', async () => {
    const botId = crypto.randomUUID();
    await seedTestData(pool, [
      {
        id: botId,
        userId: 1,
        token: encryptToken('token', encryptionKey),
        name: 'Bot',
        webhookSecret,
        schema: createMockBotSchema({
          initialState: 'gallery',
          states: {
            gallery: {
              message: 'Gallery',
              mediaGroup: [
                { type: 'photo', url: 'https://example.com/1.jpg', caption: 'One' },
                { type: 'photo', url: 'https://example.com/2.jpg', caption: 'Two' },
              ],
              buttons: [{ text: 'Next', nextState: 'gallery' }],
            },
          },
        }),
      },
    ]);

    const response = await sendWebhook(createMockTelegramUpdate({ update_id: 3 }), botId);

    expect(response.status).toBe(200);
    expect(sendMediaGroup).toHaveBeenCalled();
    expect(sendTelegramMessageWithKeyboard).toHaveBeenCalled();
  });

  it('sends url button as inline keyboard', async () => {
    const botId = crypto.randomUUID();
    await seedTestData(pool, [
      {
        id: botId,
        userId: 1,
        token: encryptToken('token', encryptionKey),
        name: 'Bot',
        webhookSecret,
        schema: createMockBotSchema({
          initialState: 'start',
          states: {
            start: {
              message: 'Links',
              buttons: [{ type: 'url', text: 'Open', url: 'https://example.com' }],
            },
          },
        }),
      },
    ]);

    const response = await sendWebhook(createMockTelegramUpdate({ update_id: 4 }), botId);

    expect(response.status).toBe(200);
    expect(sendTelegramMessageWithKeyboard).toHaveBeenCalled();
  });

  it('falls back to text when media fails', async () => {
    (sendPhoto as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

    const botId = crypto.randomUUID();
    await seedTestData(pool, [
      {
        id: botId,
        userId: 1,
        token: encryptToken('token', encryptionKey),
        name: 'Bot',
        webhookSecret,
        schema: createMockBotSchema({
          initialState: 'photo',
          states: {
            photo: {
              message: 'Photo',
              media: { type: 'photo', url: 'https://example.com/photo.jpg' },
            },
          },
        }),
      },
    ]);

    const response = await sendWebhook(createMockTelegramUpdate({ update_id: 5 }), botId);

    expect(response.status).toBe(200);
    expect(sendTelegramMessage).toHaveBeenCalled();
  });
});
